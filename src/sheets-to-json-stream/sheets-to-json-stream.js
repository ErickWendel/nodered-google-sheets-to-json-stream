const google = require('@googleapis/sheets');
const { JWT } = require('google-auth-library');

const SheetsToJSON = require('./backend/sheetsToJSON');
const registerRoutes = require('./backend/sheetsRoutes');
const { configureProgress } = require('./backend/utils')


function onErrorStatus(node) {
    return (text) => {
        node.status({
            fill: "red",
            shape: "ring",
            text
        })
    }
}

function onSuccessStatus(node) {
    return (text, color = 'green') => {
        node.status({
            fill: color,
            shape: "dot",
            text
        })
    }
}

function SheetsToJSONModule(RED, sheetsToJSON) {
    return function (ctx) {
        RED.nodes.createNode(this, ctx);
        const node = this;
        let _isProcessing = false;

        const context = {
            spreadsheetId: ctx.sheetId,
            range: `${ctx.sheetList}!${ctx.range}`,
            sheetTitle: ctx.sheetList,
            columns: ctx.columns,
            config: ctx.config,
        };

        // if it's added by an automation, don't initialize the module
        if (Object.values(context).filter(item => !item).length) return

        const getGoogleAuthNode = () => JSON.parse(RED.nodes.getNode(context.config).credentials.config);

        const reportErrorStatus = onErrorStatus(node)
        const reportSuccessStatus = onSuccessStatus(node)
        const progress = configureProgress({
            node,
            range: context.range,
            onError: reportErrorStatus,
            onSuccess: reportSuccessStatus,
        });

        reportSuccessStatus(`${context.range}`, 'gray')

        node.on('input', async function (msg) {
            if (_isProcessing) {
                _isProcessing = false;
                progress.update(true);
                return;
            }

            reportSuccessStatus(`Process starting...`, 'blue')

            _isProcessing = true;
            try {
                await sheetsToJSON.process({
                    context,
                    isProcessing: _isProcessing,
                    onData(data) {
                        progress.update()
                        node.send({
                            ...msg,
                            payload: data
                        })
                    },
                    getGoogleAuthNode,
                })
                _isProcessing = false;

            } catch (error) {
                console.log('Error', error.stack);
                node.send({
                    ...msg,
                    payload: error.stack
                });
                _isProcessing = false;
                reportErrorStatus("Error")
            }
        });

        node.on('close', async function () { });
    };
}

module.exports = function main(RED) {
    const sheetsToJSON = new SheetsToJSON({ google, JWT });
    registerRoutes(RED, sheetsToJSON);
    RED.nodes.registerType('sheets-to-json-stream', SheetsToJSONModule(RED, sheetsToJSON), {
        credentials: {
            config: {}
        }
    });
};
