import {
  ConfidentialClientApplication,
  PublicClientApplication,
  type AuthenticationResult
} from "@azure/msal-node";
import { FabricConfig } from "./types.js";

const FABRIC_SCOPES = ["https://api.fabric.microsoft.com/.default"];

export interface TokenProvider {
  getAccessToken(): Promise<string>;
}

export class MsalTokenProvider implements TokenProvider {
  private publicClient?: PublicClientApplication;
  private confidentialClient?: ConfidentialClientApplication;

  constructor(private readonly config: FabricConfig) {}

  async getAccessToken(): Promise<string> {
    const result =
      this.config.authMode === "service_principal"
        ? await this.acquireServicePrincipalToken()
        : await this.acquireDeviceCodeToken();

    if (!result?.accessToken) {
      throw new Error("MSAL did not return an access token.");
    }
    return result.accessToken;
  }

  private async acquireDeviceCodeToken(): Promise<AuthenticationResult | null> {
    if (!this.config.clientId) {
      throw new Error("FABRIC_CLIENT_ID is required for device_code auth.");
    }
    this.publicClient ??= new PublicClientApplication({
      auth: {
        clientId: this.config.clientId,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}`
      }
    });

    return this.publicClient.acquireTokenByDeviceCode({
      scopes: FABRIC_SCOPES,
      deviceCodeCallback: (response) => {
        process.stderr.write(`${response.message}\n`);
      }
    });
  }

  private async acquireServicePrincipalToken(): Promise<AuthenticationResult | null> {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error("FABRIC_CLIENT_ID and FABRIC_CLIENT_SECRET are required for service_principal auth.");
    }
    this.confidentialClient ??= new ConfidentialClientApplication({
      auth: {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}`
      }
    });

    return this.confidentialClient.acquireTokenByClientCredential({
      scopes: FABRIC_SCOPES
    });
  }
}
