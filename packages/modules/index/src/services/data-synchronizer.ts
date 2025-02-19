import {
  CommonEvents,
  ContainerRegistrationKeys,
  groupBy,
  Modules,
  promiseAll,
} from "@medusajs/framework/utils"
import {
  Event,
  ILockingModule,
  IndexTypes,
  Logger,
  ModulesSdkTypes,
  RemoteQueryFunction,
  SchemaObjectEntityRepresentation,
} from "@medusajs/types"
import { IndexMetadataStatus, Orchestrator } from "@utils"
import { setTimeout } from "timers/promises"
export class DataSynchronizer {
  #container: Record<string, any>
  #isReady: boolean = false
  #schemaObjectRepresentation: IndexTypes.SchemaObjectRepresentation
  #storageProvider: IndexTypes.StorageProvider
  #orchestrator!: Orchestrator

  get #query() {
    return this.#container[
      ContainerRegistrationKeys.QUERY
    ] as RemoteQueryFunction
  }

  get #locking() {
    return this.#container[Modules.LOCKING] as ILockingModule
  }

  get #indexMetadataService(): ModulesSdkTypes.IMedusaInternalService<any> {
    return this.#container.indexMetadataService
  }

  get #indexSyncService(): ModulesSdkTypes.IMedusaInternalService<any> {
    return this.#container.indexSyncService
  }

  get #indexDataService(): ModulesSdkTypes.IMedusaInternalService<any> {
    return this.#container.indexDataService
  }

  // @ts-ignore
  get #indexRelationService(): ModulesSdkTypes.IMedusaInternalService<any> {
    return this.#container.indexRelationService
  }

  get #logger(): Logger {
    try {
      return this.#container.logger
    } catch (err) {
      return console as unknown as Logger
    }
  }

  constructor(container: Record<string, any>) {
    this.#container = container
  }

  #isReadyOrThrow() {
    if (!this.#isReady) {
      throw new Error(
        "DataSynchronizer is not ready. Call onApplicationStart first."
      )
    }
  }

  onApplicationStart({
    schemaObjectRepresentation,
    storageProvider,
  }: {
    lockDuration?: number
    schemaObjectRepresentation: IndexTypes.SchemaObjectRepresentation
    storageProvider: IndexTypes.StorageProvider
  }) {
    this.#storageProvider = storageProvider
    this.#schemaObjectRepresentation = schemaObjectRepresentation

    this.#isReady = true
  }

  async syncEntities(
    entities: {
      entity: string
      fields: string
      fields_hash: string
    }[],
    lockDuration: number = 1000 * 60 * 5
  ) {
    this.#isReadyOrThrow()
    const entitiesToSync = entities.map((entity) => entity.entity)
    this.#orchestrator = new Orchestrator(this.#locking, entitiesToSync, {
      lockDuration,
    })
    await this.#orchestrator.process(this.#taskRunner.bind(this))
  }

  async removeEntities(entities: string[], staleOnly: boolean = false) {
    this.#isReadyOrThrow()

    const staleCondition = staleOnly ? { staled_at: { $ne: null } } : {}

    const dataToDelete = await this.#indexDataService.list({
      ...staleCondition,
      name: entities,
    })

    const toDeleteByEntity = groupBy(dataToDelete, "name")

    for (const entity of toDeleteByEntity.keys()) {
      const records = toDeleteByEntity.get(entity)
      const ids = records?.map(
        (record: { data: { id: string } }) => record.data.id
      )
      if (!ids?.length) {
        continue
      }

      if (this.#schemaObjectRepresentation[entity]) {
        // Here we assume that some data have been deleted from from the source and we are cleaning since they are still staled in the index and we remove them from the index

        // TODO: expand storage provider interface
        await (this.#storageProvider as any).onDelete({
          entity,
          data: ids,
          schemaEntityObjectRepresentation:
            this.#schemaObjectRepresentation[entity],
        })
      } else {
        // Here we assume that the entity is not indexed anymore as it is not part of the schema object representation and we are cleaning the index
        // TODO: Drop the partition somewhere
        await promiseAll([
          this.#container.manager.execute(
            `DELETE FROM "index_data" WHERE "name" = ?`,
            [entity]
          ),
          this.#container.manager.execute(
            `DELETE FROM "index_relation" WHERE "parent_name" = ? OR "child_name" = ?`,
            [entity, entity]
          ),
        ])
      }
    }
  }

  async #updatedStatus(entity: string, status: IndexMetadataStatus) {
    await this.#indexMetadataService.update({
      data: {
        status,
      },
      selector: {
        entity,
      },
    })
  }

  async #taskRunner(entity: string) {
    this.#logger.info(`[Index engine] syncing entity '${entity}'`)

    const [[lastCursor]] = await promiseAll([
      this.#indexSyncService.list(
        {
          entity,
        },
        {
          select: ["last_key"],
        }
      ),
      this.#updatedStatus(entity, IndexMetadataStatus.PROCESSING),
      this.#container.manager.execute(
        `UPDATE "index_data" SET "staled_at" = NOW() WHERE "name" = ?`,
        [entity]
      ),
    ])

    let startTime = performance.now()
    let chunkStartTime = startTime

    const finalAcknoledgement = await this.syncEntity({
      entityName: entity,
      pagination: {
        cursor: lastCursor?.last_key,
      },
      ack: async (ack) => {
        const endTime = performance.now()
        const chunkElapsedTime = (endTime - chunkStartTime).toFixed(2)
        const promises: Promise<any>[] = []

        if (ack.lastCursor) {
          this.#logger.debug(
            `[Index engine] syncing entity '${entity}' updating last cursor to ${ack.lastCursor} (+${chunkElapsedTime}ms)`
          )

          promises.push(
            this.#indexSyncService.update({
              data: {
                last_key: ack.lastCursor,
              },
              selector: {
                entity,
              },
            })
          )

          if (!ack.done && !ack.err) {
            promises.push(this.#orchestrator.renewLock(entity))
          }
        }

        if (ack.err) {
          this.#logger.error(
            `[Index engine] syncing entity '${entity}' failed with error (+${chunkElapsedTime}ms):\n${ack.err.message}`
          )
        }

        if (ack.done) {
          const elapsedTime = (endTime - startTime).toFixed(2)
          this.#logger.info(
            `[Index engine] syncing entity '${entity}' done (+${elapsedTime}ms)`
          )
        }

        await promiseAll(promises)

        chunkStartTime = performance.now()
      },
    })

    if (finalAcknoledgement.done) {
      await promiseAll([
        this.#updatedStatus(entity, IndexMetadataStatus.DONE),
        this.#indexSyncService.update({
          data: {
            last_key: finalAcknoledgement.lastCursor,
          },
          selector: {
            entity,
          },
        }),
        this.removeEntities([entity], true),
      ])
    }

    if (finalAcknoledgement.err) {
      await this.#updatedStatus(entity, IndexMetadataStatus.ERROR)
    }
  }

  async syncEntity({
    entityName,
    pagination = {},
    ack,
  }: {
    entityName: string
    pagination?: {
      cursor?: string
      updated_at?: string | Date
      limit?: number
      batchSize?: number
    }
    ack: (ack: {
      lastCursor: string | null
      done?: boolean
      err?: Error
    }) => Promise<void>
  }): Promise<{
    lastCursor: string | null
    done?: boolean
    err?: Error
  }> {
    this.#isReadyOrThrow()

    const schemaEntityObjectRepresentation = this.#schemaObjectRepresentation[
      entityName
    ] as SchemaObjectEntityRepresentation

    const { alias, moduleConfig } = schemaEntityObjectRepresentation
    const isLink = !!moduleConfig?.isLink

    if (!alias) {
      const acknoledgement = {
        lastCursor: pagination.cursor ?? null,
        done: true,
      }

      await ack(acknoledgement)
      return acknoledgement
    }

    const entityPrimaryKey = "id"
    const moduleHasId = !!moduleConfig?.primaryKeys?.includes("id")
    if (!moduleHasId) {
      const acknoledgement = {
        lastCursor: pagination.cursor ?? null,
        err: new Error(
          `Entity ${entityName} does not have a property 'id'. The 'id' must be provided and must be orderable (e.g ulid)`
        ),
      }

      await ack(acknoledgement)
      return acknoledgement
    }

    let processed = 0
    let currentCursor = pagination.cursor!
    const batchSize = Math.min(pagination.batchSize ?? 100, 100)
    const limit = pagination.limit ?? Infinity
    let error = null

    while (processed < limit) {
      const filters: Record<string, any> = {}

      if (currentCursor) {
        filters[entityPrimaryKey] = { $gt: currentCursor }
      }

      if (pagination.updated_at) {
        filters["updated_at"] = { $gt: pagination.updated_at }
      }

      const { data } = await this.#query.graph({
        entity: alias,
        fields: [entityPrimaryKey],
        filters,
        pagination: {
          order: {
            [entityPrimaryKey]: "asc",
          },
          take: batchSize,
        },
      })

      if (!data.length) {
        break
      }

      const envelop: Event = {
        data,
        name: !isLink
          ? `*.${CommonEvents.CREATED}`
          : `*.${CommonEvents.ATTACHED}`,
      }

      try {
        await this.#storageProvider.consumeEvent(
          schemaEntityObjectRepresentation
        )(envelop)
        currentCursor = data[data.length - 1][entityPrimaryKey]
        processed += data.length

        await ack({ lastCursor: currentCursor })
      } catch (err) {
        error = err
        break
      }

      await setTimeout(0)
    }

    let acknoledgement: { lastCursor: string; done?: boolean; err?: Error } = {
      lastCursor: currentCursor,
      done: true,
    }

    if (error) {
      acknoledgement = {
        lastCursor: currentCursor,
        err: error,
      }
      await ack(acknoledgement)
      return acknoledgement
    }

    await ack(acknoledgement)
    return acknoledgement
  }
}
