import {
  Constructor,
  IEventBusModuleService,
  IndexTypes,
  InternalModuleDeclaration,
  Logger,
  ModulesSdkTypes,
  RemoteQueryFunction,
} from "@medusajs/framework/types"
import {
  MikroOrmBaseRepository as BaseRepository,
  ContainerRegistrationKeys,
  Modules,
  ModulesSdkUtils,
} from "@medusajs/framework/utils"
import { schemaObjectRepresentationPropertiesToOmit } from "@types"
import {
  buildSchemaObjectRepresentation,
  Configuration,
  defaultSchema,
  gqlSchemaToTypes,
} from "@utils"
import { DataSynchronizer } from "./data-synchronizer"

type InjectedDependencies = {
  logger: Logger
  [Modules.EVENT_BUS]: IEventBusModuleService
  storageProviderCtr: Constructor<IndexTypes.StorageProvider>
  [ContainerRegistrationKeys.QUERY]: RemoteQueryFunction
  storageProviderCtrOptions: unknown
  baseRepository: BaseRepository
  indexMetadataService: ModulesSdkTypes.IMedusaInternalService<any>
  indexSyncService: ModulesSdkTypes.IMedusaInternalService<any>
  dataSynchronizer: DataSynchronizer
}

export default class IndexModuleService
  extends ModulesSdkUtils.MedusaService({})
  implements IndexTypes.IIndexService
{
  private readonly container_: InjectedDependencies
  private readonly moduleOptions_: IndexTypes.IndexModuleOptions

  protected readonly eventBusModuleService_: IEventBusModuleService

  protected schemaObjectRepresentation_: IndexTypes.SchemaObjectRepresentation
  protected schemaEntitiesMap_: Record<string, any>

  protected readonly storageProviderCtr_: Constructor<IndexTypes.StorageProvider>
  protected readonly storageProviderCtrOptions_: unknown

  protected storageProvider_: IndexTypes.StorageProvider

  private get indexMetadataService_(): ModulesSdkTypes.IMedusaInternalService<any> {
    return this.container_.indexMetadataService
  }

  private get indexSyncService_(): ModulesSdkTypes.IMedusaInternalService<any> {
    return this.container_.indexSyncService
  }

  private get dataSynchronizer_(): DataSynchronizer {
    return this.container_.dataSynchronizer
  }

  private get logger_(): Logger {
    try {
      return this.container_.logger
    } catch (e) {
      return console as unknown as Logger
    }
  }

  constructor(
    container: InjectedDependencies,
    protected readonly moduleDeclaration: InternalModuleDeclaration
  ) {
    super(...arguments)

    this.container_ = container
    this.moduleOptions_ = (moduleDeclaration.options ??
      moduleDeclaration) as unknown as IndexTypes.IndexModuleOptions

    const {
      [Modules.EVENT_BUS]: eventBusModuleService,
      storageProviderCtr,
      storageProviderCtrOptions,
    } = container

    this.eventBusModuleService_ = eventBusModuleService
    this.storageProviderCtr_ = storageProviderCtr
    this.storageProviderCtrOptions_ = storageProviderCtrOptions
    if (!this.eventBusModuleService_) {
      throw new Error(
        "EventBusModuleService is required for the IndexModule to work"
      )
    }
  }

  __hooks = {
    onApplicationStart(this: IndexModuleService) {
      return this.onApplicationStart_()
    },
  }

  protected async onApplicationStart_() {
    try {
      this.buildSchemaObjectRepresentation_()

      this.storageProvider_ = new this.storageProviderCtr_(
        this.container_,
        Object.assign(this.storageProviderCtrOptions_ ?? {}, {
          schemaObjectRepresentation: this.schemaObjectRepresentation_,
          entityMap: this.schemaEntitiesMap_,
        }),
        this.moduleOptions_
      ) as IndexTypes.StorageProvider

      this.registerListeners()

      if (this.storageProvider_.onApplicationStart) {
        await this.storageProvider_.onApplicationStart()
      }

      await gqlSchemaToTypes(this.moduleOptions_.schema ?? defaultSchema)

      this.dataSynchronizer_.onApplicationStart({
        schemaObjectRepresentation: this.schemaObjectRepresentation_,
        storageProvider: this.storageProvider_,
      })

      const configurationChecker = new Configuration({
        logger: this.logger_,
        schemaObjectRepresentation: this.schemaObjectRepresentation_,
        indexMetadataService: this.indexMetadataService_,
        indexSyncService: this.indexSyncService_,
        dataSynchronizer: this.dataSynchronizer_,
      })
      const entitiesMetadataChanged = await configurationChecker.checkChanges()

      if (entitiesMetadataChanged.length) {
        await this.dataSynchronizer_.syncEntities(entitiesMetadataChanged)
      }
    } catch (e) {
      this.logger_.error(e)
    }
  }

  async query<const TEntry extends string>(
    config: IndexTypes.IndexQueryConfig<TEntry>
  ): Promise<IndexTypes.QueryResultSet<TEntry>> {
    return await this.storageProvider_.query(config)
  }

  protected registerListeners() {
    const schemaObjectRepresentation = (this.schemaObjectRepresentation_ ??
      {}) as IndexTypes.SchemaObjectRepresentation

    for (const [entityName, schemaEntityObjectRepresentation] of Object.entries(
      schemaObjectRepresentation
    )) {
      if (schemaObjectRepresentationPropertiesToOmit.includes(entityName)) {
        continue
      }

      ;(
        schemaEntityObjectRepresentation as IndexTypes.SchemaObjectEntityRepresentation
      ).listeners.forEach((listener) => {
        this.eventBusModuleService_.subscribe(
          listener,
          this.storageProvider_.consumeEvent(schemaEntityObjectRepresentation)
        )
      })
    }
  }

  private buildSchemaObjectRepresentation_() {
    if (this.schemaObjectRepresentation_) {
      return this.schemaObjectRepresentation_
    }

    const baseSchema = `
      scalar DateTime
      scalar Date
      scalar Time
      scalar JSON
    `
    const [objectRepresentation, entityMap] = buildSchemaObjectRepresentation(
      baseSchema + (this.moduleOptions_.schema ?? defaultSchema)
    )

    this.schemaObjectRepresentation_ = objectRepresentation
    this.schemaEntitiesMap_ = entityMap

    return this.schemaObjectRepresentation_
  }
}
