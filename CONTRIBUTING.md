# Testing

- This project uses **playwright** to make e2e tests as users iteract with the page

- First you'll need to create at least 2 sheets on a Google Spreadsheet, with at least 5 columns and 5 lines.
- Then update the `spreadsheet.example.json` in the root of this project adding your credentials and spreadsheet metada
- Then rename it to `spreadsheet.json`

## In case you're curious on how you `spreadsheet.json` should look like

```json
{

    "spreadsheetId": "1Mte7nOo6oqvI4me-tnEenCci0l8bR04810B_q1U_1Ro",
    "sheets": [
        {
            "name": "Sheet1",
            "range": "A1:AZ2279",
            "columns": [
                "sheetColumn1" // replace this with the columns on your sheet
            ]
        },
        {
            "name": "Sheet2",
            "range": "A1:Z1000",
            "columns": []
        }
    ],
    "googleAuthCredentials": {
        "type": "service_account",
        "private_key": "-----BEGIN PRIVATE KEY-----\n=\n-----END PRIVATE KEY-----\n", // your complete private key
        "client_email": "email@ew-academy.iam.gserviceaccount.com",
    }
}

```
## Docker

- This project leverages Docker use a nodered valid instance, so tests can go to nodered editor and trigger events as an user
- Make sure you have **Docker** and **Docker-compose** Installed

- Then run `npm run docker:start` to spin up the container and install the local package into the container
- Then run `npm docker:install-module` to install this module in the docker container
- Then run `npm ci` to restore dependencies
- Then run `npx playwright install chromium --with-deps` to install playwright's chromium
- Then run `npm run test:dev` to run test suite

# Making changes

In the [package.json](./package.json) I put several docker commands to help you make changes at ease

If you wanna see the package being installed on a local folder, go on [./misc/docker-compose.yml](./misc/docker-compose.yml) and uncomment the line refering to the volume `# - ./data:/data`

- Then run `npm ci` to restore dependencies
- Then run `npm run docker:start` to spin up the container and install the local package into the container
- then run `npm run docker:restart-nodered-on-change` to watch for changes locally and automatically update the container and see nodered logs in real time
- In another terminal, run `npm test` to run test suite

