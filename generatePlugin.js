const fs = require('fs');
const path = require('path');
const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
const { BedrockAgentRuntimeClient } = require('@aws-sdk/client-bedrock-agent-runtime');

function generatePlugin() {
    // Get all commands from both clients
    const runtimeCommands = Object.keys(require('@aws-sdk/client-bedrock-runtime'))
        .filter(key => key.endsWith('Command'))
        .map(key => ({
            name: key.replace('Command', ''),
            commandName: key,
            client: 'BedrockRuntimeClient',
            category: 'Amazon Bedrock'
        }));

    const agentCommands = Object.keys(require('@aws-sdk/client-bedrock-agent-runtime'))
        .filter(key => key.endsWith('Command'))
        .map(key => ({
            name: key.replace('Command', ''),
            commandName: key,
            client: 'BedrockAgentRuntimeClient',
            category: 'Amazon Bedrock Agent'
        }));

    const allCommands = [...runtimeCommands, ...agentCommands];

    // Generate JavaScript file content
    const jsContent = generateJavaScript(allCommands);
    const htmlContent = generateHTML(allCommands);

    // Write files
    fs.writeFileSync(path.join(__dirname, 'aws-bedrock.js'), jsContent);
    fs.writeFileSync(path.join(__dirname, 'aws-bedrock.html'), htmlContent);

    console.log(`Generated nodes for ${allCommands.length} Bedrock commands:`);
    allCommands.forEach(cmd => console.log(`- ${cmd.category}: ${cmd.name}`));
}

function generateJavaScript(commands) {
    const imports = `const { 
        BedrockRuntimeClient,
        ${commands
            .filter(cmd => cmd.client === 'BedrockRuntimeClient')
            .map(cmd => cmd.commandName)
            .join(',\n        ')}
    } = require('@aws-sdk/client-bedrock-runtime');
    
    const {
        BedrockAgentRuntimeClient,
        ${commands
            .filter(cmd => cmd.client === 'BedrockAgentRuntimeClient')
            .map(cmd => cmd.commandName)
            .join(',\n        ')}
    } = require('@aws-sdk/client-bedrock-agent-runtime');`;

    const configNode = `
    function BedrockConfigNode(config) {
        RED.nodes.createNode(this, config);
        this.name = config.name;
        this.region = config.region;
        
        if (this.credentials) {
            this.accessKey = this.credentials.accessKey;
            this.secretKey = this.credentials.secretKey;
        }
    }`;

    const nodeDefinitions = commands.map(cmd => `
    function Bedrock${cmd.name}Node(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new ${cmd.client}({
                region: node.awsConfig.region,
                credentials: {
                    accessKeyId: node.awsConfig.credentials.accessKey,
                    secretAccessKey: node.awsConfig.credentials.secretKey
                }
            });
        }

        async function handleStreamingResponse(response, msg) {
            try {
                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = new TextDecoder().decode(value);
                    const parsedChunk = JSON.parse(chunk);
                    
                    const intermediateMsg = RED.util.cloneMessage(msg);
                    intermediateMsg.payload = parsedChunk;
                    intermediateMsg.complete = false;
                    node.send([intermediateMsg, null]);
                }

                const finalMsg = RED.util.cloneMessage(msg);
                finalMsg.complete = true;
                node.send([finalMsg, null]);
                
            } catch (error) {
                const errorMsg = RED.util.cloneMessage(msg);
                errorMsg.payload = { error: error.message, details: error };
                node.send([null, errorMsg]);
            }
        }

        client = initializeClient();
        
        node.on('input', async function(msg) {
            if (!client) {
                const errorMsg = RED.util.cloneMessage(msg);
                errorMsg.payload = { error: "AWS client not initialized" };
                node.status({fill:"red", shape:"ring", text:"not initialized"});
                node.send([null, errorMsg]);
                return;
            }

            try {
                node.status({fill:"blue", shape:"dot", text:"processing"});
                
                // For model invocation nodes
                if (${cmd.client === 'BedrockRuntimeClient'}) {
                    // Check for messages in either location
                    const messages = msg.messages || (msg.payload && msg.payload.messages);
                    
                    if (!messages) {
                        const errorMsg = RED.util.cloneMessage(msg);
                        errorMsg.payload = { error: "Input must contain either msg.messages or msg.payload.messages array" };
                        node.status({fill:"red", shape:"ring", text:"invalid input"});
                        node.send([null, errorMsg]);
                        return;
                    }

                    // Build command input using message properties with fallback to defaults
                    const commandInput = {
                        modelId: msg.modelId || config['modelId-default'],
                        messages: messages,
                    };

                    // Add optional parameters if they exist in message or defaults
                    ['maxTokens', 'temperature', 'topP', 'stopSequences'].forEach(param => {
                        const msgValue = msg[param] || (msg.payload && msg.payload[param]);
                        if (msgValue !== undefined) {
                            commandInput[param] = msgValue;
                        } else if (config[param + '-default'] !== undefined) {
                            commandInput[param] = config[param + '-default'];
                        }
                    });

                    const command = new ${cmd.commandName}(commandInput);
                    const response = await client.send(command);

                    if (response.body instanceof ReadableStream) {
                        await handleStreamingResponse(response, msg);
                        return;
                    }

                    const successMsg = RED.util.cloneMessage(msg);
                    successMsg.payload = response;
                    node.status({fill:"green", shape:"dot", text:"success"});
                    node.send([successMsg, null]);
                } else {
                    // For agent runtime nodes, pass through the entire msg.payload
                    if (!msg.payload) {
                        const errorMsg = RED.util.cloneMessage(msg);
                        errorMsg.payload = { error: "Input must contain a payload object" };
                        node.status({fill:"red", shape:"ring", text:"invalid input"});
                        node.send([null, errorMsg]);
                        return;
                    }

                    const command = new ${cmd.commandName}(msg.payload);
                    const response = await client.send(command);

                    const successMsg = RED.util.cloneMessage(msg);
                    successMsg.payload = response;
                    node.status({fill:"green", shape:"dot", text:"success"});
                    node.send([successMsg, null]);
                }
                
            } catch (error) {
                const errorMsg = RED.util.cloneMessage(msg);
                errorMsg.payload = { 
                    error: error.message,
                    details: error
                };
                node.status({fill:"red", shape:"ring", text:"error"});
                node.send([null, errorMsg]);
            }
        });
    }`).join('\n');

    const registrations = commands.map(cmd => `
    RED.nodes.registerType("bedrock-${cmd.name.toLowerCase()}", Bedrock${cmd.name}Node, {
        defaults: {
            name: { value: "" },
            awsConfig: { type: "bedrock-config", required: true },
            'modelId-default': { value: "anthropic.claude-v2" },
            'maxTokens-default': { value: 2048 },
            'temperature-default': { value: 0.7 },
            'topP-default': { value: 1 },
            'stopSequences-default': { value: "" }
        },
        inputs: 1,
        outputs: 2,
        outputLabels: ["success", "error"],
        icon: "aws.png",
        color: '#FF9900',
        category: '${cmd.category}',
        label: function() { return this.name || "Bedrock ${cmd.name}"; },
        paletteLabel: "Bedrock ${cmd.name}"
    });`).join('\n');

    return `module.exports = function(RED) {
    ${imports}

    ${configNode}

    RED.nodes.registerType("bedrock-config", BedrockConfigNode, {
        credentials: {
            accessKey: { type: "text" },
            secretKey: { type: "password" }
        }
    });

    ${nodeDefinitions}

    ${registrations}
}`;
}

function generateHTML(commands) {
    const configTemplate = `
<script type="text/html" data-template-name="bedrock-config">
    <div class="form-row">
        <label for="node-config-input-name"><i class="fa fa-tag"></i> Name</label>
        <input type="text" id="node-config-input-name" placeholder="Name">
    </div>
    <div class="form-row">
        <label for="node-config-input-region"><i class="fa fa-globe"></i> Region</label>
        <input type="text" id="node-config-input-region" placeholder="us-east-1">
    </div>
    <div class="form-row">
        <label for="node-config-input-accessKey"><i class="fa fa-key"></i> Access Key</label>
        <input type="text" id="node-config-input-accessKey">
    </div>
    <div class="form-row">
        <label for="node-config-input-secretKey"><i class="fa fa-lock"></i> Secret Key</label>
        <input type="password" id="node-config-input-secretKey">
    </div>
</script>`;

    const nodeTemplates = commands.map(cmd => {
        // Different templates for runtime vs agent nodes
        const isRuntimeNode = cmd.client === 'BedrockRuntimeClient';
        
        return `
<script type="text/html" data-template-name="bedrock-${cmd.name.toLowerCase()}">
    <div class="form-row">
        <label for="node-input-name"><i class="fa fa-tag"></i> Name</label>
        <input type="text" id="node-input-name" placeholder="Name">
    </div>
    <div class="form-row">
        <label for="node-input-awsConfig"><i class="fa fa-user"></i> AWS Config</label>
        <input type="text" id="node-input-awsConfig">
    </div>
    ${isRuntimeNode ? `
    <div class="form-row">
        <label for="node-input-modelId-default"><i class="fa fa-code"></i> Default Model ID</label>
        <input type="text" id="node-input-modelId-default" placeholder="anthropic.claude-v2">
    </div>
    <div class="form-row">
        <label for="node-input-maxTokens-default"><i class="fa fa-text-width"></i> Default Max Tokens</label>
        <input type="number" id="node-input-maxTokens-default" placeholder="2048">
    </div>
    <div class="form-row">
        <label for="node-input-temperature-default"><i class="fa fa-thermometer-half"></i> Default Temperature</label>
        <input type="number" id="node-input-temperature-default" placeholder="0.7" min="0" max="1" step="0.1">
    </div>
    <div class="form-row">
        <label for="node-input-topP-default"><i class="fa fa-random"></i> Default Top P</label>
        <input type="number" id="node-input-topP-default" placeholder="1" min="0" max="1" step="0.1">
    </div>
    <div class="form-row">
        <label for="node-input-stopSequences-default"><i class="fa fa-stop"></i> Default Stop Sequences</label>
        <input type="text" id="node-input-stopSequences-default" placeholder="Comma-separated sequences">
    </div>` : ''}
</script>

<script type="text/html" data-help-name="bedrock-${cmd.name.toLowerCase()}">
    <p>Executes the ${cmd.name} operation on ${cmd.category}.</p>

    <h3>Inputs</h3>
    <dl class="message-properties">
        ${isRuntimeNode ? `
        <dt>messages <span class="property-type">array</span></dt>
        <dd>Required. Array of message objects. Can be provided directly in msg.messages or in msg.payload.messages. Example:
            <pre>[
    {
        "role": "user",
        "content": [
            {
                "text": "Tell me a joke"
            }
        ]
    }
]</pre>
        </dd>
        
        <dt class="optional">modelId <span class="property-type">string</span></dt>
        <dd>Optional. Overrides the default Model ID configured in the node.</dd>
        
        <dt class="optional">maxTokens <span class="property-type">number</span></dt>
        <dd>Optional. Overrides the default maximum tokens.</dd>
        
        <dt class="optional">temperature <span class="property-type">number</span></dt>
        <dd>Optional. Overrides the default temperature.</dd>
        
        <dt class="optional">topP <span class="property-type">number</span></dt>
        <dd>Optional. Overrides the default top P value.</dd>
        
        <dt class="optional">stopSequences <span class="property-type">array</span></dt>
        <dd>Optional. Overrides the default stop sequences.</dd>` : `
        <dt>payload <span class="property-type">object</span></dt>
        <dd>Required. The parameters for the ${cmd.name} operation.</dd>`}
    </dl>

    <h3>Outputs</h3>
    <ol class="node-ports">
        <li>Success Output
            <dl class="message-properties">
                <dt>payload <span class="property-type">object</span></dt>
                <dd>The response from the ${cmd.name} operation</dd>
            </dl>
        </li>
        <li>Error Output
            <dl class="message-properties">
                <dt>payload <span class="property-type">object</span></dt>
                <dd>Error details if the operation fails</dd>
            </dl>
        </li>
    </ol>
</script>`;
    }).join('\n');

    const registrations = commands.map(cmd => `
    RED.nodes.registerType('bedrock-${cmd.name.toLowerCase()}',{
        category: '${cmd.category}',
        color: '#FF9900',
        defaults: {
            name: { value: "" },
            awsConfig: { type: "bedrock-config", required: true },
            'modelId-default': { value: "anthropic.claude-v2" },
            'maxTokens-default': { value: 2048 },
            'temperature-default': { value: 0.7 },
            'topP-default': { value: 1 },
            'stopSequences-default': { value: "" }
        },
        inputs: 1,
        outputs: 2,
        outputLabels: ["success", "error"],
        icon: "aws.png",
        label: function() {
            return this.name || "Bedrock ${cmd.name}";
        },
        paletteLabel: "Bedrock ${cmd.name}"
    });`).join('\n');

    return `${configTemplate}

${nodeTemplates}

<script type="text/javascript">
    RED.nodes.registerType('bedrock-config',{
        category: 'config',
        defaults: {
            name: { value: "" },
            region: { value: "us-east-1", required: true }
        },
        credentials: {
            accessKey: { type: "text" },
            secretKey: { type: "password" }
        },
        label: function() {
            return this.name || "Bedrock Config";
        }
    });

    ${registrations}
</script>`;
}

generatePlugin();
