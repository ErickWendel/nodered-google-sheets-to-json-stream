
module.exports = function (RED) {
    function gauth(ctx) {
        RED.nodes.createNode(this, ctx);
        this.creds = ctx.creds;
    }

    RED.nodes.registerType("gauth", gauth);
};
