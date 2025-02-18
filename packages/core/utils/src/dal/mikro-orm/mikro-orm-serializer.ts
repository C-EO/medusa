import {
  Collection,
  EntityDTO,
  EntityMetadata,
  helper,
  IPrimaryKey,
  Loaded,
  Platform,
  Reference,
  ReferenceKind,
  SerializationContext,
  SerializeOptions,
  Utils,
} from "@mikro-orm/core"

type CustomSerializeOptions<T, P = any> = SerializeOptions<T, P & string> & {
  preventCircularRef?: boolean
  populate?: [keyof T][] | boolean
}

function isVisible<T extends object>(
  meta: EntityMetadata<T>,
  propName: string,
  options: CustomSerializeOptions<T> = {}
): boolean {
  if (options.populate === true) {
    return true
  }

  if (
    Array.isArray(options.populate) &&
    options.exclude?.find((item) => item === propName)
  ) {
    return false
  }

  if (
    Array.isArray(options.populate) &&
    (options.populate?.find(
      (item) => item === propName || item.startsWith(propName + ".")
    ) ||
      options.populate.includes("*"))
  ) {
    return true
  }

  const prop = meta.properties[propName]
  const visible = (prop && !prop.hidden) || prop === undefined // allow unknown properties
  const prefixed = prop && !prop.primary && propName.startsWith("_") // ignore prefixed properties, if it's not a PK

  return visible && !prefixed
}

function isPopulated<T extends object>(
  entity: T,
  propName: string,
  options: CustomSerializeOptions<T>
): boolean {
  if (
    Array.isArray(options.populate) &&
    (options.populate?.find(
      (item) => item === propName || item.startsWith(propName + ".")
    ) ||
      options.populate.includes("*"))
  ) {
    return true
  }

  if (typeof options.populate === "boolean") {
    return options.populate
  }

  return false
}

/**
 * Custom property filtering for the serialization which takes into account circular references to not return them.
 * @param propName
 * @param meta
 * @param options
 * @param parents
 */
function filterEntityPropToSerialize({
  propName,
  meta,
  options,
  parents,
}: {
  propName: string
  meta: EntityMetadata
  options: CustomSerializeOptions<any>
  parents?: string[]
}): boolean {
  parents ??= []
  const isVisibleRes = isVisible(meta, propName, options)
  const prop = meta.properties[propName]

  // Only prevent circular references if prop is a relation
  if (
    prop &&
    options.preventCircularRef &&
    isVisibleRes &&
    prop.kind !== ReferenceKind.SCALAR
  ) {
    // mapToPk would represent a foreign key and we want to keep them
    if (!!prop.mapToPk) {
      return true
    }

    return !parents.some((parent) => parent === prop.type)
  }

  return isVisibleRes
}

export class EntitySerializer {
  static serialize<T extends object, P extends string = never>(
    entity: T,
    options: CustomSerializeOptions<T, P> = {},
    parents: string[] = []
  ): EntityDTO<Loaded<T, P>> {
    const parents_ = Array.from(new Set(parents))

    const wrapped = helper(entity)
    const meta = wrapped.__meta
    let contextCreated = false

    if (!wrapped.__serializationContext.root) {
      const root = new SerializationContext<T>({} as any)
      SerializationContext.propagate(
        root,
        entity,
        (meta, prop) => meta.properties[prop]?.kind !== ReferenceKind.SCALAR
      )
      contextCreated = true
    }

    const root = wrapped.__serializationContext
      .root! as SerializationContext<any> & {
      visitedSerialized?: Map<string, any>
    }

    const ret = {} as EntityDTO<Loaded<T, P>>
    const keys = new Set<string>(meta.primaryKeys)
    Object.keys(entity).forEach((prop) => keys.add(prop))

    const visited = root.visited.has(entity)
    if (!visited) {
      root.visited.add(entity)
    }

    ;[...keys]
      /** Medusa Custom properties filtering **/
      .filter((prop) =>
        filterEntityPropToSerialize({
          propName: prop,
          meta,
          options,
          parents: parents_,
        })
      )
      .map((prop) => {
        const cycle = root.visit(meta.className, prop)

        if (cycle && visited) {
          return [prop, undefined]
        }

        const val = this.processProperty<T>(
          prop as keyof T & string,
          entity,
          options,
          parents_
        )

        if (!cycle) {
          root.leave(meta.className, prop)
        }

        if (options.skipNull && Utils.isPlainObject(val)) {
          Utils.dropUndefinedProperties(val, null)
        }

        return [prop, val]
      })
      .filter(
        ([, value]) =>
          typeof value !== "undefined" && !(value === null && options.skipNull)
      )
      .forEach(
        ([prop, value]) =>
          (ret[
            this.propertyName(
              meta,
              prop as keyof T & string,
              wrapped.__platform
            )
          ] = value as T[keyof T & string])
      )

    if (contextCreated) {
      root.close()
    }

    if (!wrapped.isInitialized()) {
      return ret
    }

    // decorated getters
    meta.props
      .filter(
        (prop) =>
          prop.getter &&
          prop.getterName === undefined &&
          typeof entity[prop.name] !== "undefined" &&
          isVisible(meta, prop.name, options)
      )
      .forEach(
        (prop) =>
          (ret[this.propertyName(meta, prop.name, wrapped.__platform)] =
            this.processProperty(prop.name, entity, options, parents_))
      )

    // decorated get methods
    meta.props
      .filter(
        (prop) =>
          prop.getterName &&
          (entity[prop.getterName] as unknown) instanceof Function &&
          isVisible(meta, prop.name, options)
      )
      .forEach(
        (prop) =>
          (ret[this.propertyName(meta, prop.name, wrapped.__platform)] =
            this.processProperty(
              prop.getterName as keyof T & string,
              entity,
              options,
              parents_
            ))
      )

    return ret
  }

  private static propertyName<T>(
    meta: EntityMetadata<T>,
    prop: string,
    platform?: Platform
  ): string {
    /* istanbul ignore next */
    if (meta.properties[prop]?.serializedName) {
      return meta.properties[prop].serializedName as string
    }

    if (meta.properties[prop]?.primary && platform) {
      return platform.getSerializedPrimaryKeyField(prop) as string
    }

    return prop
  }

  private static processProperty<T extends object>(
    prop: string,
    entity: T,
    options: CustomSerializeOptions<T>,
    parents: string[] = []
  ): T[keyof T] | undefined {
    const parents_ = [...parents, entity.constructor.name]

    const parts = prop.split(".")
    prop = parts[0] as string & keyof T
    const wrapped = helper(entity)
    const property = wrapped.__meta.properties[prop]
    const serializer = property?.serializer

    // getter method
    if ((entity[prop] as unknown) instanceof Function) {
      const returnValue = (
        entity[prop] as unknown as () => T[keyof T & string]
      )()
      if (!options.ignoreSerializers && serializer) {
        return serializer(returnValue)
      }
      return returnValue
    }

    /* istanbul ignore next */
    if (!options.ignoreSerializers && serializer) {
      return serializer(entity[prop])
    }

    if (Utils.isCollection(entity[prop])) {
      return this.processCollection(
        prop as keyof T & string,
        entity,
        options,
        parents_
      )
    }

    if (Utils.isEntity(entity[prop], true)) {
      return this.processEntity(
        prop as keyof T & string,
        entity,
        wrapped.__platform,
        options,
        parents_
      )
    }

    /* istanbul ignore next */
    if (property?.reference === ReferenceKind.EMBEDDED) {
      if (Array.isArray(entity[prop])) {
        return (entity[prop] as object[]).map((item) =>
          helper(item).toJSON()
        ) as T[keyof T]
      }

      if (Utils.isObject(entity[prop])) {
        return helper(entity[prop]).toJSON() as T[keyof T]
      }
    }

    const customType = property?.customType

    if (customType) {
      return customType.toJSON(entity[prop], wrapped.__platform)
    }

    return wrapped.__platform.normalizePrimaryKey(
      entity[prop] as unknown as IPrimaryKey
    ) as unknown as T[keyof T]
  }

  private static extractChildOptions<T extends object, U extends object>(
    options: CustomSerializeOptions<T>,
    prop: keyof T & string
  ): CustomSerializeOptions<U> {
    const extractChildElements = (items: string[]) => {
      return items
        .filter((field) => field.startsWith(`${prop}.`))
        .map((field) => field.substring(prop.length + 1))
    }

    return {
      ...options,
      populate:
        Array.isArray(options.populate) && !options.populate.includes("*")
          ? extractChildElements(options.populate as unknown as string[])
          : options.populate,
      exclude:
        Array.isArray(options.exclude) && !options.exclude.includes("*")
          ? extractChildElements(options.exclude)
          : options.exclude,
    } as CustomSerializeOptions<U>
  }

  private static processEntity<T extends object>(
    prop: keyof T & string,
    entity: T,
    platform: Platform,
    options: CustomSerializeOptions<T>,
    parents: string[] = []
  ): T[keyof T] | undefined {
    const parents_ = [...parents, entity.constructor.name]

    const child = Reference.unwrapReference(entity[prop] as T)
    const wrapped = helper(child)
    const populated =
      isPopulated(child, prop, options) && wrapped.isInitialized()
    const expand = populated || options.forceObject || !wrapped.__managed

    if (expand) {
      return this.serialize(
        child,
        this.extractChildOptions(options, prop),
        parents_
      ) as T[keyof T]
    }

    return platform.normalizePrimaryKey(
      wrapped.getPrimaryKey() as IPrimaryKey
    ) as T[keyof T]
  }

  private static processCollection<T extends object>(
    prop: keyof T & string,
    entity: T,
    options: CustomSerializeOptions<T>,
    parents: string[] = []
  ): T[keyof T] | undefined {
    const parents_ = [...parents, entity.constructor.name]
    const col = entity[prop] as unknown as Collection<T>

    if (!col.isInitialized()) {
      return undefined
    }

    return col.getItems(false).map((item) => {
      if (isPopulated(item, prop, options)) {
        return this.serialize(
          item,
          this.extractChildOptions(options, prop),
          parents_
        )
      }

      return helper(item).getPrimaryKey()
    }) as unknown as T[keyof T]
  }
}

export const mikroOrmSerializer = <TOutput extends object>(
  data: any,
  options?: Parameters<typeof EntitySerializer.serialize>[1] & {
    preventCircularRef?: boolean
    populate?: string[] | boolean
  }
): Promise<TOutput> => {
  return new Promise<TOutput>((resolve) => {
    options ??= {}

    const data_ = (Array.isArray(data) ? data : [data]).filter(Boolean)

    const forSerialization: unknown[] = []
    const notForSerialization: unknown[] = []

    data_.forEach((object) => {
      if (object.__meta) {
        return forSerialization.push(object)
      }

      return notForSerialization.push(object)
    })

    let result: any = forSerialization.map((entity) =>
      EntitySerializer.serialize(entity, {
        forceObject: true,
        populate: ["*"],

        preventCircularRef: true,
        ...options,
      } as CustomSerializeOptions<any>)
    ) as TOutput[]

    if (notForSerialization.length) {
      result = result.concat(notForSerialization)
    }

    resolve(Array.isArray(data) ? result : result[0])
  })
}
