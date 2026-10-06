# Wan Ofi Furniture — Local logins

- Web app: http://localhost:5174
- API: http://localhost:5050

Every seeded account uses the password **`Password123!`** (development data only).

| Role | Email |
|---|---|
| Owner | owner@wanofi.com |
| Accountant | accountant@wanofi.com |
| Accountant (2nd) | accountant2@wanofi.com |
| Supervisor | supervisor@wanofi.com |
| Carpenter | carpenter@wanofi.com |
| Upholsterer | upholsterer@wanofi.com |
| Painter | painter@wanofi.com |
| Assembler | assembler@wanofi.com |
| Installer | installer@wanofi.com |
| Designer | designer@wanofi.com |
| Customer | amina@example.com |
| Customer | john@example.com |

## Starting the app again (e.g. after a restart)

In one terminal, from the `server` folder (API + embedded database):

```bash
npm run dev:memory
```

In a second terminal, from the `client` folder (website):

```bash
npm run dev
```

To wipe all data and reseed, use:

```bash
npm run dev:memory -- --reset
```
