# Knex Nodered Connection

This Node-RED custom node provides a Knex instance for DB connections. (currently only working with Postgres)

## Configuration

- **URI**: The connection string for the PostgreSQL database.
- **SSL**: Whether to use SSL for the connection.
- **Timezone**: The timezone to set for the connection.
- **Pool Log**: Whether to log pool events.
- **Pool Min**: Minimum number of connections in the pool.
- **Pool Max**: Maximum number of connections in the pool.
- **Acquire Timeout Millis**: The time in milliseconds to wait for a connection to be acquired.
- **Create Timeout Millis**: The time in milliseconds to wait for a connection to be created.
- **Idle Timeout Millis**: The time in milliseconds to wait before an idle connection is released.

## Example

You an checkout the examples in [./examples](https://github.com/ErickWendel/nodered-knex-connection/blob/main/examples/)

![Node-RED flow](https://github.com/ErickWendel/nodered-knex-connection/blob/main/example.png?raw=true)

```json
[{"id":"df81e2e5ef4d4071","type":"inject","z":"5e284026436c6b42","name":"","props":[{"p":"payload"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"","payloadType":"date","x":320,"y":100,"wires":[["6d8ffd6bbb02d8cf"]]},{"id":"1b23eda5384dcd27","type":"debug","z":"5e284026436c6b42","name":"show output","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","statusVal":"","statusType":"auto","x":870,"y":100,"wires":[]},{"id":"164a1ef82b99eabb","type":"function","z":"5e284026436c6b42","name":"select 1 from db","func":"const knex = msg.knex\nconst result = await knex.raw(`\n            SELECT 1 as result;\n        `);\n\nmsg.payload = result.rows[0].result; \n\nreturn msg;","outputs":1,"timeout":0,"noerr":0,"initialize":"","finalize":"","libs":[],"x":680,"y":100,"wires":[["1b23eda5384dcd27"]]},{"id":"6d8ffd6bbb02d8cf","type":"knex-node","z":"5e284026436c6b42","uri":"${POSTGRES_URI}","searchPath":"[\"public\"]","ssl":false,"timezone":"${TZ}","poolMin":"1","poolMax":10,"acquireTimeoutMillis":30000,"createTimeoutMillis":30000,"idleTimeoutMillis":1000,"additionalKnexConf":"{}","x":490,"y":100,"wires":[["164a1ef82b99eabb"]]}]
```
## Features
    - Reuses DB connections across nodes/flows
    - Terminate connections when they're not needed anymore
    - In case of deploying specific nodes, it doesn't change the running ones
    - Update node status every 200ms checking if the DB Connection is still valid

# Dependencies

It uses knex on 3.1.0 and pg on 8.12.0