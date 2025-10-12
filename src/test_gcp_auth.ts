import { GoogleAuth } from 'npm:google-auth-library@9.10.0';

// Replace with your actual values from Supabase environment variables
const GOOGLE_CLIENT_EMAIL = "contractanalyser@contractanalyser-474623.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC57nL1vzPqzSnB\nXwoD/iAydtOKaEqi9Euzqp+1ZzQQeRy1XXCioVWYa9IDBdHhPR2D8GRayL6X+wA7\nLQFOX9Uuk14m4Jo4Wkk924y0WXTVVf3sloUlwVQq2Fy+vsLJFgqlEBG9uLRistfo\nMsTKFC3fovLVX6AQ53ApUBxwi1+cGEffKM54igjnm0Ov+QdVVb26HaDA3J7XnoB7\nDHq05Hbm4mfdNKYrC+V30mgulp2/ONwrEPCTTB5VBTJMAOYpwi1+76R47jv7UANC\nTNmaYrtgOlsvH8ArLSk3ykOvfNEKS4pffpo19CWW1xsgbYVRl7C7GfdpZi50bbsD\n5YwenkY/AgMBAAECggEASbu/eCgeiRdaXzZ2zNWK5ChORJ2ON6gkmzfnRPOL6Jp2\n4Y+QGtZbEOp1KsC0lht76HY8/emM981Qrqbu1StY6bMES+uXDRD06aR23JB7Lhz/\naULZw3qzC5io0vXoXgExMHs6Zd/pHRjqWUlE1BSDiqPeo/JbkkiNqLx9wr3qqQYj\nzLNAI2mUw+NeqlzEUKpbN8YkhSwhsaF2XTQeYrJuzSlMzWWbKXwThMHwPQKquA1W\nZ/xm2nhRS0BGmNeFmhc+02OAIcS84RQfhFsysMElTn0KMgF1ZupdZMuwe/odu8MR\nxqbT4e5vZbVwJDGfxBiDH0n5ZfFk5MxwUZ8ncmld8QKBgQD04B/yjAgBsi2OHt1G\n5pHQhoiC+Gd/fDwIun8ANmEKfePKhZ7C02rdy2SG1IE9i2uE85LI6pnqdp2eOQSX\nL1HKabCQIO7+Ta6hBS6iK7+cwySUBk6gwOYqJ3E52IOdqk97Uem1F8HQWcFjtKQH\nv/tcTjtONP51N3dfsFbPFfer7wKBgQDCYM+62vj3fPqEL5K0frdHt86eVsQLBhI0\nO5iCf843Ldk1h5dNDFAEfRmJ35VRH+O3NoT/VrY2xNpI4cw7BpXySGtnpMZxkMyO\nUXsm7cJ6FKM74M0R/t5t4ZVfZrmrkURKGPUe3ySN565ObVxIURq1soEbhCxv770r\nr4YKQhf6sQKBgQDFmhqNqkxHuhWiyus67JKcGAQO1A8IxCLZ1Ezpyffy9HWeFsdv\nZhWllxyu5MrJ9Di2V6uKcC32EvPMGyzGJ0w0L6doFvtkwSD7FOh1uyHriVl6DcDj\nXeYd/CgVSs+iqi1rUUVrehlPXS5+m+WFz3kyGnsm+AKiajjtQao7f/mVhwKBgC11\ndL+3PfJBs0y3c7mN2CykjrJfNVPX7CoDauzUx7Kls+JKTTmg/i+sw0qsy9fnOCnSL\ntJj+z4iJiz9mR1w6kxDhrPTFTX+7zIswNSwKiOQCNZbIYU1nHN/31PZF0QB17dGi\nepkouKTTXSmMW/uxtBxwTc+Ant/i4ov39dIqWO9RAoGAQGrd8oZN53M3F1WOy+4y\n998NauA7K+ptNwI7Sfee+suU0B9tKq/AZNcnsYJ1cw4LjNOe5v893A3bE1r20jtk\nv1R1BjYWRQehNV4KorMveV8yU21i/G5av/u5MUkJwlDcB3oDrB/nCSCtaDaNzlPX\n4cPAWlNMQFwoHd6Bqs5ppJI=\n-----END PRIVATE KEY-----\n`; // Use backticks for multiline string

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