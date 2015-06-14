///<reference path="../googleappis/googleapis.d.ts" />

declare module "google-spreadsheets" {
    import googleapis = require('googleapis');


    class GoogleSpreadsheetsSheet {
        cells(options:Object, cb:(err, cells:any)=>void);
    }

    class GoogleSpreadsheets {
        worksheets:GoogleSpreadsheetsSheet[];
    }


    interface GoogleSpreadsheetsSettings {
        key:string;
        auth:googleapis.auth.OAuth2;
    }

    export = GoogleSpreadsheetsClient;

    function GoogleSpreadsheetsClient(settings:GoogleSpreadsheetsSettings, cb:(err:Error,spreadsheet:GoogleSpreadsheets)=>void);
}