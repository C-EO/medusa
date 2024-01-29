import { AbstractAuthModuleProvider, isString } from "@medusajs/utils"
import { AuthenticationInput, AuthenticationResponse } from "@medusajs/types"

import { AuthUserService } from "@services"
import Scrypt from "scrypt-kdf"

class EmailPasswordProvider extends AbstractAuthModuleProvider {
  public static PROVIDER = "emailpass"
  public static DISPLAY_NAME = "Email/Password Authentication"

  protected readonly authUserSerivce_: AuthUserService

  constructor({ authUserService }: { authUserService: AuthUserService }) {
    super(arguments[0])

    this.authUserSerivce_ = authUserService
  }

  async authenticate(
    userData: AuthenticationInput
  ): Promise<AuthenticationResponse> {
    const { email, password } = userData.body

    if (!password || !isString(password)) {
      return {
        success: false,
        error: "Password should be a string",
      }
    }

    if (!email || !isString(email)) {
      return {
        success: false,
        error: "Email should be a string",
      }
    }

    const authUser = await this.authUserSerivce_.retrieveByProviderAndEntityId(
      email,
      EmailPasswordProvider.PROVIDER
    )

    const password_hash = authUser.provider_metadata?.password

    if (isString(password_hash)) {
      const buf = Buffer.from(password_hash as string, "base64")

      const success = await Scrypt.verify(buf, password)

      if (success) {
        delete authUser.provider_metadata!.password

        return { success, authUser: JSON.parse(JSON.stringify(authUser)) }
      }
    }

    return {
      success: false,
      error: "Invalid email or password",
    }
  }
}

export default EmailPasswordProvider