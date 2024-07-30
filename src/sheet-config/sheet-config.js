
module.exports = function (RED) {
    function gauth(ctx) {
        RED.nodes.createNode(this, ctx);
        this.config = ctx.config;
    }

    RED.nodes.registerType("google-sheets-config", gauth, {
        credentials: {
            config: {}
        }
    });
};
