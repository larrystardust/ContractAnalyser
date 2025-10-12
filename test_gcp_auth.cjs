"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var google_auth_library_1 = require("google-auth-library");
// Replace with your actual values from Supabase environment variables
var GOOGLE_CLIENT_EMAIL = "image-invoker@analyser-474911.iam.gserviceaccount.com";
var GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHumcEXJ/4o2Qv\n8kxJ1lotbtdELP/sEYLFmxFRy0C+x5LDRwGzYY8DO9VMLiDwXYcfbHoNe+Q53tYY\nZ4aY6eo6HP2vC3O5bmBzai1zrAfd8FcHTAJ/qXJESGKcJJBrS6yJyhXQLe3xQMpU\nHC8jWpDBpdxrwAoM1uiGQwDekTlrWBz0GrzUDd7adDqg3J6x/Si7c8isY0jdRkvj\nDgcvmy+dQmnJSak7vmwlU8lxVthuU+yOBY8bOG7kvmwhF98zmr2J+5Al7B7NZ/ff\nxHqXvtW16Xdw75jXatYDlFGetI0cm+w6E0WQ4M1eHJjU5MxmgrlpGED9SvbTn7ma\nqiOCzGUfAgMBAAECggEABcq5hw5akz7FvoAzxyZgqhWfR3pYl5Nwa+ORzoHq6D1o\nW6JZAccv+wOGrXVe/ilwLDCcn3x6w1Tbd4y1AgUyhinmD2fxHKz/PgmTtNmFxuFb\n3LnPDr2usx04QtfqmjnxEHPcSxOx5T+gPm0szsUnEn6JVFSW1gV7a71QrqOeeybf\nSFUgLeQxMRcNxmG+7RpXe1YzjannEJnzu3DEThUDH7oRw/QyIf8fuX01KqB2HIO9\n8NH0vM8Ex7gr1tJBzc+pLCYKdbQt6nPUM+AjLSzGTn+jYh0MXbkBZTYCdTJ0Vaxg\ndga/4PSMA8g8GjcZnYPxF8DiNgMlHBcTDHjv8aE9jQKBgQD9yGJjmlJaPszkWiNZ\nkgye7dvfyifvJWP9uRQchnm9r08tTSGou2ca/AOjvW28jECO4CPK4URlisa8HkUF\nVdJJ3XwI7JfsZgc7BSKVH7SKDNmx28c9bWzs7jfx2cXEsR91WyCgjrBmsekrgLLO\nP2u1YdEbxMty6lui2GetQClzSwKBgQDJeR5Q3ynCiFu4ajb453awgXZiRJHdhehS\na+mm7Ryz5qZ1H7BgHQgVNDum1huFwvq4uqAGQwLXetdZ8BZRzwm3hYpsp6FumPt9\nHNwUkoQAMNkZVUBE8yKZyFMOlXZbBm6BMEdzriU5khpA4lhnz3V+g1dQeU8S3XRt\nkUwr9qPc/QKBgQCm6QcE2Td2kT0yprH/NBZG5MuqqQuQtrfH5NT8Wdlxzv41HjiY\nAAE09zDxnSGyU1AWaAZCZdwVKKvCh+n/M02mNRxhxjG5UfVJdPwktgCIlyEKYDDv\nDqwIPDjhQMhYr+GvzqprzszoDfT8Hp37Fi0h016zc8AXKVnxhYDSqpNYdwKBgBwI\nlVZNZwMhdBm59cI2esZejTlpLx6yxjvJti466faCToEXkrQc9gX1SaOSQSwgkEBp\n/2A/rMKM3jAufvyNIV3+3970iDraYIvtGxZluKZKJbsnqJSvfA4H2L67v0c1IuUo\n8ZhAD//tu2dx1zlCnaen4Ntatcz7MXsZb47id7SFAoGADysqFO8D4SeuU3BhFWa/\n1Q3R5oX+L7ebzrw4guP7Sg8d8YStLQe1XmiNk9TtbaPyVfkQDpWsYWFTrsLQu/56\ns36uKEdeH0yMtBgTdhhJ7mVrMUnmEK8gWXirrQvgKt8QiE19RpFIK/tmyR1I1vE+\ntJqOQw9jUbKvw6pTJAir11U=\n-----END PRIVATE KEY-----\n"; // Use backticks for multiline string
function testGoogleAuth() {
    return __awaiter(this, void 0, void 0, function () {
        var auth, accessToken, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    auth = new google_auth_library_1.GoogleAuth({
                        credentials: {
                            client_email: GOOGLE_CLIENT_EMAIL,
                            private_key: GOOGLE_PRIVATE_KEY,
                        },
                        scopes: ['https://www.googleapis.com/auth/cloud-platform'], // Or 'https://www.googleapis.com/auth/cloud-vision'
                    });
                    return [4 /*yield*/, auth.getAccessToken()];
                case 1:
                    accessToken = _b.sent();
                    if (accessToken.token) {
                        console.log("Successfully obtained access token!");
                        console.log("Access Token:", accessToken.token.substring(0, 20) + "..."); // Log first 20 chars
                        console.log("Expires in:", (_a = accessToken.res) === null || _a === void 0 ? void 0 : _a.data.expires_in, "seconds");
                    }
                    else {
                        console.error("Failed to obtain access token: Token is null or undefined.");
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _b.sent();
                    console.error("Error during Google Auth test:", error_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
testGoogleAuth();
