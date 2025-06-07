# Testing

- This project uses **playwright** to make e2e tests as users iteract with the page

- First you'll need to create at least 2 sheets on a Google Spreadsheet, with at least 5 columns and 5 lines. ([Here an example for you](https://docs.google.com/spreadsheets/d/1cevlmmrjmewwIN1iVFZ9dqzAxpV-zYYOxhvJOISeixA/edit?usp=sharing)) 
> [!WARNING]  
> By default google sheets have 1000 lines and 26 columns, so you should delete all empty lines and columns as I did in the example above
- Then update the `spreadsheets.example.json` in the root of this project adding your credentials and spreadsheet metada
- Then rename it to `spreadsheets.json`

## Setting up googleAuthCredentials

To setup auth this node uses a google service account:

Create a new service account from [This Page](https://console.cloud.google.com/iam-admin/serviceaccounts?_ga=2.184919274.-272657095.1578084478)

Download a JSON credentials object for the service account.

Give that account access to the sheets API.

Share your sheet with the email address of the service account eg `nodered@nodered-12345.iam.gserviceaccount.com`

## In case you're curious on how you `spreadsheets.json` should look like

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

- Then run `npm run docker:start-nodered` to spin up the container and install the local package into the container
- Then run `npm run docker:install-module` to install this module in the docker container
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

