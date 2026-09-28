import type { Page, Locator } from '@playwright/test';
/** Login screen of the app. */
export class LoginPage {
  readonly submit: Locator;
  constructor(private readonly page: Page) {
    this.submit = page.getByRole('button', { name: 'Sign in' });
  }
  /** Logs in through the UI form. */
  async login(user: string, pass: string): Promise<void> {
    await this.page.goto('/login');
    await this.page.getByLabel('User').fill(user);
    await this.page.getByLabel('Password').fill(pass);
    await this.submit.click();
  }
  async errorText(): Promise<string> {
    return this.page.getByRole('alert').innerText();
  }
  private secret() {}
}