export interface HttpFetcher {
  fetch(
    url: string,
    params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions,
  ): GoogleAppsScript.URL_Fetch.HTTPResponse;
}

export interface MailSender {
  sendEmail(to: string, subject: string, body: string): void;
}

export interface PropertyReader {
  getProperty(key: string): string | null;
}

export interface PropertyWriter {
  setProperty(key: string, value: string): void;
}
