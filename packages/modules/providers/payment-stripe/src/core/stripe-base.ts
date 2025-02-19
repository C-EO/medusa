import Stripe from "stripe"

import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  CreateAccountHolderInput,
  CreateAccountHolderOutput,
  DeleteAccountHolderInput,
  DeleteAccountHolderOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ListPaymentMethodsInput,
  ListPaymentMethodsOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  SavePaymentMethodInput,
  SavePaymentMethodOutput,
  UpdateAccountHolderInput,
  UpdateAccountHolderOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  AbstractPaymentProvider,
  isDefined,
  isPresent,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import {
  ErrorCodes,
  ErrorIntentStatus,
  PaymentIntentOptions,
  StripeOptions,
} from "../types"
import {
  getAmountFromSmallestUnit,
  getSmallestUnit,
} from "../utils/get-smallest-unit"

abstract class StripeBase extends AbstractPaymentProvider<StripeOptions> {
  protected readonly options_: StripeOptions
  protected stripe_: Stripe
  protected container_: Record<string, unknown>

  static validateOptions(options: StripeOptions): void {
    if (!isDefined(options.apiKey)) {
      throw new Error("Required option `apiKey` is missing in Stripe plugin")
    }
  }

  protected constructor(
    cradle: Record<string, unknown>,
    options: StripeOptions
  ) {
    // @ts-ignore
    super(...arguments)

    this.container_ = cradle
    this.options_ = options

    this.stripe_ = new Stripe(options.apiKey)
  }

  abstract get paymentIntentOptions(): PaymentIntentOptions

  get options(): StripeOptions {
    return this.options_
  }

  normalizePaymentIntentParameters(
    extra?: Record<string, unknown>
  ): Partial<Stripe.PaymentIntentCreateParams> {
    const res = {} as Partial<Stripe.PaymentIntentCreateParams>

    res.description = (extra?.payment_description ??
      this.options_?.paymentDescription) as string

    res.capture_method =
      (extra?.capture_method as "automatic" | "manual") ??
      this.paymentIntentOptions.capture_method ??
      (this.options_.capture ? "automatic" : "manual")

    res.setup_future_usage =
      (extra?.setup_future_usage as "off_session" | "on_session" | undefined) ??
      this.paymentIntentOptions.setup_future_usage

    res.payment_method_types = this.paymentIntentOptions
      .payment_method_types as string[]

    res.automatic_payment_methods =
      (extra?.automatic_payment_methods as { enabled: true } | undefined) ??
      (this.options_?.automaticPaymentMethods ? { enabled: true } : undefined)

    res.off_session = extra?.off_session as boolean | undefined

    res.confirm = extra?.confirm as boolean | undefined

    res.payment_method = extra?.payment_method as string | undefined

    res.return_url = extra?.return_url as string | undefined

    return res
  }

  async getPaymentStatus({
    data,
  }: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const id = data?.id as string
    if (!id) {
      throw this.buildError(
        "No payment intent ID provided while getting payment status",
        new Error("No payment intent ID provided")
      )
    }

    const paymentIntent = await this.stripe_.paymentIntents.retrieve(id)
    const dataResponse = paymentIntent as unknown as Record<string, unknown>

    switch (paymentIntent.status) {
      case "requires_payment_method":
        if (paymentIntent.last_payment_error) {
          return { status: PaymentSessionStatus.ERROR, data: dataResponse }
        }
        return { status: PaymentSessionStatus.PENDING, data: dataResponse }
      case "requires_confirmation":
      case "processing":
        return { status: PaymentSessionStatus.PENDING, data: dataResponse }
      case "requires_action":
        return {
          status: PaymentSessionStatus.REQUIRES_MORE,
          data: dataResponse,
        }
      case "canceled":
        return { status: PaymentSessionStatus.CANCELED, data: dataResponse }
      case "requires_capture":
        return { status: PaymentSessionStatus.AUTHORIZED, data: dataResponse }
      case "succeeded":
        return { status: PaymentSessionStatus.CAPTURED, data: dataResponse }
      default:
        return { status: PaymentSessionStatus.PENDING, data: dataResponse }
    }
  }

  async initiatePayment({
    currency_code,
    amount,
    data,
    context,
  }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const additionalParameters = this.normalizePaymentIntentParameters(data)

    const intentRequest: Stripe.PaymentIntentCreateParams = {
      amount: getSmallestUnit(amount, currency_code),
      currency: currency_code,
      metadata: { session_id: data?.session_id as string },
      ...additionalParameters,
    }

    intentRequest.customer = context?.account_holder?.data?.id as
      | string
      | undefined

    let sessionData
    try {
      sessionData = (await this.stripe_.paymentIntents.create(intentRequest, {
        idempotencyKey: context?.idempotency_key,
      })) as unknown as Record<string, unknown>
    } catch (e) {
      throw this.buildError(
        "An error occurred in InitiatePayment during the creation of the stripe payment intent",
        e
      )
    }

    return {
      id: sessionData.id,
      data: sessionData,
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const statusResponse = await this.getPaymentStatus(input)
    return statusResponse
  }

  async cancelPayment({
    data,
    context,
  }: CancelPaymentInput): Promise<CancelPaymentOutput> {
    try {
      const id = data?.id as string

      if (!id) {
        return { data: data }
      }

      const res = await this.stripe_.paymentIntents.cancel(id, {
        idempotencyKey: context?.idempotency_key,
      })
      return { data: res as unknown as Record<string, unknown> }
    } catch (error) {
      if (error.payment_intent?.status === ErrorIntentStatus.CANCELED) {
        return { data: error.payment_intent }
      }

      throw this.buildError("An error occurred in cancelPayment", error)
    }
  }

  async capturePayment({
    data,
    context,
  }: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const id = data?.id as string

    try {
      const intent = await this.stripe_.paymentIntents.capture(id, {
        idempotencyKey: context?.idempotency_key,
      })
      return { data: intent as unknown as Record<string, unknown> }
    } catch (error) {
      if (error.code === ErrorCodes.PAYMENT_INTENT_UNEXPECTED_STATE) {
        if (error.payment_intent?.status === ErrorIntentStatus.SUCCEEDED) {
          return { data: error.payment_intent }
        }
      }

      throw this.buildError("An error occurred in capturePayment", error)
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return await this.cancelPayment(input)
  }

  async refundPayment({
    amount,
    data,
    context,
  }: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const id = data?.id as string
    if (!id) {
      throw this.buildError(
        "No payment intent ID provided while refunding payment",
        new Error("No payment intent ID provided")
      )
    }

    try {
      const currencyCode = data?.currency as string
      await this.stripe_.refunds.create(
        {
          amount: getSmallestUnit(amount, currencyCode),
          payment_intent: id as string,
        },
        {
          idempotencyKey: context?.idempotency_key,
        }
      )
    } catch (e) {
      throw this.buildError("An error occurred in refundPayment", e)
    }

    return { data }
  }

  async retrievePayment({
    data,
  }: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    try {
      const id = data?.id as string
      const intent = await this.stripe_.paymentIntents.retrieve(id)

      intent.amount = getAmountFromSmallestUnit(intent.amount, intent.currency)

      return { data: intent as unknown as Record<string, unknown> }
    } catch (e) {
      throw this.buildError("An error occurred in retrievePayment", e)
    }
  }

  async updatePayment({
    data,
    currency_code,
    amount,
    context,
  }: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const amountNumeric = getSmallestUnit(amount, currency_code)
    if (isPresent(amount) && data?.amount === amountNumeric) {
      return { data }
    }

    try {
      const id = data?.id as string
      const sessionData = (await this.stripe_.paymentIntents.update(
        id,
        {
          amount: amountNumeric,
        },
        {
          idempotencyKey: context?.idempotency_key,
        }
      )) as unknown as Record<string, unknown>

      return { data: sessionData }
    } catch (e) {
      throw this.buildError("An error occurred in updatePayment", e)
    }
  }

  async createAccountHolder({
    context,
  }: CreateAccountHolderInput): Promise<CreateAccountHolderOutput> {
    const { account_holder, customer, idempotency_key } = context

    if (account_holder?.data?.id) {
      return { id: account_holder.data.id as string }
    }

    if (!customer) {
      throw this.buildError(
        "No customer in context",
        new Error("No customer provided while creating account holder")
      )
    }

    const shipping = customer.billing_address
      ? ({
          address: {
            city: customer.billing_address.city,
            country: customer.billing_address.country_code,
            line1: customer.billing_address.address_1,
            line2: customer.billing_address.address_2,
            postal_code: customer.billing_address.postal_code,
            state: customer.billing_address.province,
          },
        } as Stripe.CustomerCreateParams.Shipping)
      : undefined

    try {
      const stripeCustomer = await this.stripe_.customers.create(
        {
          email: customer.email,
          name:
            customer.company_name ||
            `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
            undefined,
          phone: customer.phone as string | undefined,
          ...shipping,
        },
        {
          idempotencyKey: idempotency_key,
        }
      )

      return {
        id: stripeCustomer.id,
        data: stripeCustomer as unknown as Record<string, unknown>,
      }
    } catch (e) {
      throw this.buildError(
        "An error occurred in createAccountHolder when creating a Stripe customer",
        e
      )
    }
  }

  async updateAccountHolder({
    context,
  }: UpdateAccountHolderInput): Promise<UpdateAccountHolderOutput> {
    const { account_holder, customer, idempotency_key } = context

    if (!account_holder?.data?.id) {
      throw this.buildError(
        "No account holder in context",
        new Error("No account holder provided while updating account holder")
      )
    }

    // If no customer context was provided, we simply don't update anything within the provider
    if (!customer) {
      return {}
    }

    const accountHolderId = account_holder.data.id as string

    const shipping = customer.billing_address
      ? ({
          address: {
            city: customer.billing_address.city,
            country: customer.billing_address.country_code,
            line1: customer.billing_address.address_1,
            line2: customer.billing_address.address_2,
            postal_code: customer.billing_address.postal_code,
            state: customer.billing_address.province,
          },
        } as Stripe.CustomerCreateParams.Shipping)
      : undefined

    try {
      const stripeCustomer = await this.stripe_.customers.update(
        accountHolderId,
        {
          email: customer.email,
          name:
            customer.company_name ||
            `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
            undefined,
          phone: customer.phone as string | undefined,
          ...shipping,
        },
        {
          idempotencyKey: idempotency_key,
        }
      )

      return {
        data: stripeCustomer as unknown as Record<string, unknown>,
      }
    } catch (e) {
      throw this.buildError(
        "An error occurred in updateAccountHolder when updating a Stripe customer",
        e
      )
    }
  }

  async deleteAccountHolder({
    context,
  }: DeleteAccountHolderInput): Promise<DeleteAccountHolderOutput> {
    const { account_holder } = context
    const accountHolderId = account_holder?.data?.id as string | undefined
    if (!accountHolderId) {
      throw this.buildError(
        "No account holder in context",
        new Error("No account holder provided while deleting account holder")
      )
    }

    try {
      await this.stripe_.customers.del(accountHolderId)
      return {}
    } catch (e) {
      throw this.buildError("An error occurred in deleteAccountHolder", e)
    }
  }

  async listPaymentMethods({
    context,
  }: ListPaymentMethodsInput): Promise<ListPaymentMethodsOutput> {
    const accountHolderId = context?.account_holder?.data?.id as
      | string
      | undefined
    if (!accountHolderId) {
      return []
    }

    const paymentMethods = await this.stripe_.customers.listPaymentMethods(
      accountHolderId,
      // In order to keep the interface simple, we just list the maximum payment methods, which should be enough in almost all cases.
      // We can always extend the interface to allow additional filtering, if necessary.
      { limit: 100 }
    )

    return paymentMethods.data.map((method) => ({
      id: method.id,
      data: method as unknown as Record<string, unknown>,
    }))
  }

  async savePaymentMethod({
    context,
    data,
  }: SavePaymentMethodInput): Promise<SavePaymentMethodOutput> {
    const accountHolderId = context?.account_holder?.data?.id as
      | string
      | undefined

    if (!accountHolderId) {
      throw this.buildError(
        "Account holder not set while saving a payment method",
        new Error("Missing account holder")
      )
    }

    const resp = await this.stripe_.setupIntents.create(
      {
        customer: accountHolderId,
        ...data,
      },
      {
        idempotencyKey: context?.idempotency_key,
      }
    )

    return { id: resp.id, data: resp as unknown as Record<string, unknown> }
  }

  async getWebhookActionAndData(
    webhookData: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const event = this.constructWebhookEvent(webhookData)
    const intent = event.data.object as Stripe.PaymentIntent

    const { currency } = intent

    switch (event.type) {
      case "payment_intent.created":
      case "payment_intent.processing":
        return {
          action: PaymentActions.PENDING,
          data: {
            session_id: intent.metadata.session_id,
            amount: getAmountFromSmallestUnit(intent.amount, currency),
          },
        }
      case "payment_intent.canceled":
        return {
          action: PaymentActions.CANCELED,
          data: {
            session_id: intent.metadata.session_id,
            amount: getAmountFromSmallestUnit(intent.amount, currency),
          },
        }
      case "payment_intent.payment_failed":
        return {
          action: PaymentActions.FAILED,
          data: {
            session_id: intent.metadata.session_id,
            amount: getAmountFromSmallestUnit(intent.amount, currency),
          },
        }
      case "payment_intent.requires_action":
        return {
          action: PaymentActions.REQUIRES_MORE,
          data: {
            session_id: intent.metadata.session_id,
            amount: getAmountFromSmallestUnit(intent.amount, currency),
          },
        }
      case "payment_intent.amount_capturable_updated":
        return {
          action: PaymentActions.AUTHORIZED,
          data: {
            session_id: intent.metadata.session_id,
            amount: getAmountFromSmallestUnit(
              intent.amount_capturable,
              currency
            ),
          },
        }
      case "payment_intent.succeeded":
        return {
          action: PaymentActions.SUCCESSFUL,
          data: {
            session_id: intent.metadata.session_id,
            amount: getAmountFromSmallestUnit(intent.amount_received, currency),
          },
        }

      default:
        return { action: PaymentActions.NOT_SUPPORTED }
    }
  }

  /**
   * Constructs Stripe Webhook event
   * @param {object} data - the data of the webhook request: req.body
   *    ensures integrity of the webhook event
   * @return {object} Stripe Webhook event
   */
  constructWebhookEvent(data: ProviderWebhookPayload["payload"]): Stripe.Event {
    const signature = data.headers["stripe-signature"] as string

    return this.stripe_.webhooks.constructEvent(
      data.rawData as string | Buffer,
      signature,
      this.options_.webhookSecret
    )
  }
  protected buildError(message: string, error: Error): Error {
    const errorDetails =
      "raw" in error ? (error.raw as Stripe.StripeRawError) : error

    return new Error(
      `${message}: ${error.message}. ${
        "detail" in errorDetails ? errorDetails.detail : ""
      }`.trim()
    )
  }
}

export default StripeBase
