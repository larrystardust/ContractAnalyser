import { GoogleAuth } from 'google-auth-library';

// Replace with your actual values from Supabase environment variables
const GOOGLE_CLIENT_EMAIL = "image-invoker@analyser-474911.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHumcEXJ/4o2Qv\n8kxJ1lotbtdELP/sEYLFmxFRy0C+x5LDRwGzYY8DO9VMLiDwXYcfbHoNe+Q53tYY\nZ4aY6eo6HP2vC3O5bmBzai1zrAfd8FcHTAJ/qXJESGKcJJBrS6yJyhXQLe3xQMpU\nHC8jWpDBpdxrwAoM1uiGQwDekTlrWBz0GrzUDd7adDqg3J6x/Si7c8isY0jdRkvj\nDgcvmy+dQmnJSak7vmwlU8lxVthuU+yOBY8bOG7kvmwhF98zmr2J+5Al7B7NZ/ff\nxHqXvtW16Xdw75jXatYDlFGetI0cm+w6E0WQ4M1eHJjU5MxmgrlpGED9SvbTn7ma\nqiOCzGUfAgMBAAECggEABcq5hw5akz7FvoAzxyZgqhWfR3pYl5Nwa+ORzoHq6D1o\nW6JZAccv+wOGrXVe/ilwLDCcn3x6w1Tbd4y1AgUyhinmD2fxHKz/PgmTtNmFxuFb\n3LnPDr2usx04QtfqmjnxEHPcSxOx5T+gPm0szsUnEn6JVFSW1gV7a71QrqOeeybf\nSFUgLeQxMRcNxmG+7RpXe1YzjannEJnzu3DEThUDH7oRw/QyIf8fuX01KqB2HIO9\n8NH0vM8Ex7gr1tJBzc+pLCYKdbQt6nPUM+AjLSzGTn+jYh0MXbkBZTYCdTJ0Vaxg\ndga/4PSMA8g8GjcZnYPxF8DiNgMlHBcTDHjv8aE9jQKBgQD9yGJjmlJaPszkWiNZ\nkgye7dvfyifvJWP9uRQchnm9r08tTSGou2ca/AOjvW28jECO4CPK4URlisa8HkUF\nVdJJ3XwI7JfsZgc7BSKVH7SKDNmx28c9bWzs7jfx2cXEsR91WyCgjrBmsekrgLLO\nP2u1YdEbxMty6lui2GetQClzSwKBgQDJeR5Q3ynCiFu4ajb453awgXZiRJHdhehS\na+mm7Ryz5qZ1H7BgHQgVNDum1huFwvq4uqAGQwLXetdZ8BZRzwm3hYpsp6FumPt9\nHNwUkoQAMNkZVUBE8yKZyFMOlXZbBm6BMEdzriU5khpA4lhnz3V+g1dQeU8S3XRt\nkUwr9qPc/QKBgQCm6QcE2Td2kT0yprH/NBZG5MuqqQuQtrfH5NT8Wdlxzv41HjiY\nAAE09zDxnSGyU1AWaAZCZdwVKKvCh+n/M02mNRxhxjG5UfVJdPwktgCIlyEKYDDv\nDqwIPDjhQMhYr+GvzqprzszoDfT8Hp37Fi0h016zc8AXKVnxhYDSqpNYdwKBgBwI\nlVZNZwMhdBm59cI2esZejTlpLx6yxjvJti466faCToEXkrQc9gX1SaOSQSwgkEBp\n/2A/rMKM3jAufvyNIV3+3970iDraYIvtGxZluKZKJbsnqJSvfA4H2L67v0c1IuUo\n8ZhAD//tu2dx1zlCnaen4Ntatcz7MXsZb47id7SFAoGADysqFO8D4SeuU3BhFWa/\n1Q3R5oX+L7ebzrw4guP7Sg8d8YStLQe1XmiNk9TtbaPyVfkQDpWsYWFTrsLQu/56\ns36uKEdeH0yMtBgTdhhJ7mVrMUnmEK8gWXirrQvgKt8QiE19RpFIK/tmyR1I1vE+\ntJqOQw9jUbKvw6pTJAir11U=\n-----END PRIVATE KEY-----\n`; // Use backticks for multiline string

async function testGoogleAuth() {
  try {
    const auth = new GoogleAuth({
      credentials: {
        client_email: GOOGLE_CLIENT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY,
      },
      scopes: ['https://www.googleapis.com/auth/cloud-platform'], // Or 'https://www.googleapis.com/auth/cloud-vision'
    });

    const accessToken = await auth.getAccessToken();
    if (accessToken.token) {
      console.log("Successfully obtained access token!");
      console.log("Access Token:", accessToken.token.substring(0, 20) + "..."); // Log first 20 chars
      console.log("Expires in:", accessToken.res?.data.expires_in, "seconds");
    } else {
      console.error("Failed to obtain access token: Token is null or undefined.");
    }
  } catch (error) {
    console.error("Error during Google Auth test:", error);
  }
}

testGoogleAuth();