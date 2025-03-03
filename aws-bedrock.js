module.exports = function(RED) {
    const { 
        BedrockRuntimeClient,
        ApplyGuardrailCommand,
        ConverseCommand,
        ConverseStreamCommand,
        GetAsyncInvokeCommand,
        InvokeModelCommand,
        InvokeModelWithResponseStreamCommand,
        ListAsyncInvokesCommand,
        StartAsyncInvokeCommand
    } = require('@aws-sdk/client-bedrock-runtime');
    
    const {
        BedrockAgentRuntimeClient,
        CreateInvocationCommand,
        CreateSessionCommand,
        DeleteAgentMemoryCommand,
        DeleteSessionCommand,
        EndSessionCommand,
        GenerateQueryCommand,
        GetAgentMemoryCommand,
        GetInvocationStepCommand,
        GetSessionCommand,
        InvokeAgentCommand,
        InvokeFlowCommand,
        InvokeInlineAgentCommand,
        ListInvocationStepsCommand,
        ListInvocationsCommand,
        ListSessionsCommand,
        ListTagsForResourceCommand,
        OptimizePromptCommand,
        PutInvocationStepCommand,
        RerankCommand,
        RetrieveAndGenerateCommand,
        RetrieveAndGenerateStreamCommand,
        RetrieveCommand,
        TagResourceCommand,
        UntagResourceCommand,
        UpdateSessionCommand
    } = require('@aws-sdk/client-bedrock-agent-runtime');

    
    function BedrockConfigNode(config) {
        RED.nodes.createNode(this, config);
        this.name = config.name;
        this.region = config.region;
        
        if (this.credentials) {
            this.accessKey = this.credentials.accessKey;
            this.secretKey = this.credentials.secretKey;
        }
    }

    RED.nodes.registerType("bedrock-config", BedrockConfigNode, {
        credentials: {
            accessKey: { type: "text" },
            secretKey: { type: "password" }
        }
    });

    
    function BedrockApplyGuardrailNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockRuntimeClient({
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
                if (true) {
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

                    const command = new ApplyGuardrailCommand(commandInput);
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

                    const command = new ApplyGuardrailCommand(msg.payload);
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
    }

    function BedrockConverseNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockRuntimeClient({
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
                if (true) {
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

                    const command = new ConverseCommand(commandInput);
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

                    const command = new ConverseCommand(msg.payload);
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
    }

    function BedrockConverseStreamNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockRuntimeClient({
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
                if (true) {
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

                    const command = new ConverseStreamCommand(commandInput);
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

                    const command = new ConverseStreamCommand(msg.payload);
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
    }

    function BedrockGetAsyncInvokeNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockRuntimeClient({
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
                if (true) {
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

                    const command = new GetAsyncInvokeCommand(commandInput);
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

                    const command = new GetAsyncInvokeCommand(msg.payload);
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
    }

    function BedrockInvokeModelNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockRuntimeClient({
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
                if (true) {
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

                    const command = new InvokeModelCommand(commandInput);
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

                    const command = new InvokeModelCommand(msg.payload);
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
    }

    function BedrockInvokeModelWithResponseStreamNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockRuntimeClient({
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
                if (true) {
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

                    const command = new InvokeModelWithResponseStreamCommand(commandInput);
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

                    const command = new InvokeModelWithResponseStreamCommand(msg.payload);
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
    }

    function BedrockListAsyncInvokesNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockRuntimeClient({
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
                if (true) {
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

                    const command = new ListAsyncInvokesCommand(commandInput);
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

                    const command = new ListAsyncInvokesCommand(msg.payload);
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
    }

    function BedrockStartAsyncInvokeNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockRuntimeClient({
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
                if (true) {
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

                    const command = new StartAsyncInvokeCommand(commandInput);
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

                    const command = new StartAsyncInvokeCommand(msg.payload);
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
    }

    function BedrockCreateInvocationNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new CreateInvocationCommand(commandInput);
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

                    const command = new CreateInvocationCommand(msg.payload);
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
    }

    function BedrockCreateSessionNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new CreateSessionCommand(commandInput);
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

                    const command = new CreateSessionCommand(msg.payload);
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
    }

    function BedrockDeleteAgentMemoryNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new DeleteAgentMemoryCommand(commandInput);
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

                    const command = new DeleteAgentMemoryCommand(msg.payload);
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
    }

    function BedrockDeleteSessionNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new DeleteSessionCommand(commandInput);
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

                    const command = new DeleteSessionCommand(msg.payload);
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
    }

    function BedrockEndSessionNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new EndSessionCommand(commandInput);
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

                    const command = new EndSessionCommand(msg.payload);
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
    }

    function BedrockGenerateQueryNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new GenerateQueryCommand(commandInput);
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

                    const command = new GenerateQueryCommand(msg.payload);
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
    }

    function BedrockGetAgentMemoryNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new GetAgentMemoryCommand(commandInput);
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

                    const command = new GetAgentMemoryCommand(msg.payload);
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
    }

    function BedrockGetInvocationStepNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new GetInvocationStepCommand(commandInput);
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

                    const command = new GetInvocationStepCommand(msg.payload);
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
    }

    function BedrockGetSessionNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new GetSessionCommand(commandInput);
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

                    const command = new GetSessionCommand(msg.payload);
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
    }

    function BedrockInvokeAgentNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new InvokeAgentCommand(commandInput);
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

                    const command = new InvokeAgentCommand(msg.payload);
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
    }

    function BedrockInvokeFlowNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new InvokeFlowCommand(commandInput);
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

                    const command = new InvokeFlowCommand(msg.payload);
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
    }

    function BedrockInvokeInlineAgentNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new InvokeInlineAgentCommand(commandInput);
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

                    const command = new InvokeInlineAgentCommand(msg.payload);
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
    }

    function BedrockListInvocationStepsNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new ListInvocationStepsCommand(commandInput);
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

                    const command = new ListInvocationStepsCommand(msg.payload);
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
    }

    function BedrockListInvocationsNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new ListInvocationsCommand(commandInput);
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

                    const command = new ListInvocationsCommand(msg.payload);
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
    }

    function BedrockListSessionsNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new ListSessionsCommand(commandInput);
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

                    const command = new ListSessionsCommand(msg.payload);
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
    }

    function BedrockListTagsForResourceNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new ListTagsForResourceCommand(commandInput);
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

                    const command = new ListTagsForResourceCommand(msg.payload);
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
    }

    function BedrockOptimizePromptNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new OptimizePromptCommand(commandInput);
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

                    const command = new OptimizePromptCommand(msg.payload);
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
    }

    function BedrockPutInvocationStepNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new PutInvocationStepCommand(commandInput);
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

                    const command = new PutInvocationStepCommand(msg.payload);
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
    }

    function BedrockRerankNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new RerankCommand(commandInput);
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

                    const command = new RerankCommand(msg.payload);
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
    }

    function BedrockRetrieveAndGenerateNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new RetrieveAndGenerateCommand(commandInput);
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

                    const command = new RetrieveAndGenerateCommand(msg.payload);
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
    }

    function BedrockRetrieveAndGenerateStreamNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new RetrieveAndGenerateStreamCommand(commandInput);
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

                    const command = new RetrieveAndGenerateStreamCommand(msg.payload);
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
    }

    function BedrockRetrieveNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new RetrieveCommand(commandInput);
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

                    const command = new RetrieveCommand(msg.payload);
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
    }

    function BedrockTagResourceNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new TagResourceCommand(commandInput);
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

                    const command = new TagResourceCommand(msg.payload);
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
    }

    function BedrockUntagResourceNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new UntagResourceCommand(commandInput);
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

                    const command = new UntagResourceCommand(msg.payload);
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
    }

    function BedrockUpdateSessionNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        this.awsConfig = RED.nodes.getNode(config.awsConfig);
        
        let client = null;
        
        function initializeClient() {
            if (!node.awsConfig) {
                node.error("No credentials configured");
                return null;
            }
            
            return new BedrockAgentRuntimeClient({
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
                if (false) {
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

                    const command = new UpdateSessionCommand(commandInput);
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

                    const command = new UpdateSessionCommand(msg.payload);
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
    }

    
    RED.nodes.registerType("bedrock-applyguardrail", BedrockApplyGuardrailNode, {
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
        category: 'Amazon Bedrock',
        label: function() { return this.name || "Bedrock ApplyGuardrail"; },
        paletteLabel: "Bedrock ApplyGuardrail"
    });

    RED.nodes.registerType("bedrock-converse", BedrockConverseNode, {
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
        category: 'Amazon Bedrock',
        label: function() { return this.name || "Bedrock Converse"; },
        paletteLabel: "Bedrock Converse"
    });

    RED.nodes.registerType("bedrock-conversestream", BedrockConverseStreamNode, {
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
        category: 'Amazon Bedrock',
        label: function() { return this.name || "Bedrock ConverseStream"; },
        paletteLabel: "Bedrock ConverseStream"
    });

    RED.nodes.registerType("bedrock-getasyncinvoke", BedrockGetAsyncInvokeNode, {
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
        category: 'Amazon Bedrock',
        label: function() { return this.name || "Bedrock GetAsyncInvoke"; },
        paletteLabel: "Bedrock GetAsyncInvoke"
    });

    RED.nodes.registerType("bedrock-invokemodel", BedrockInvokeModelNode, {
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
        category: 'Amazon Bedrock',
        label: function() { return this.name || "Bedrock InvokeModel"; },
        paletteLabel: "Bedrock InvokeModel"
    });

    RED.nodes.registerType("bedrock-invokemodelwithresponsestream", BedrockInvokeModelWithResponseStreamNode, {
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
        category: 'Amazon Bedrock',
        label: function() { return this.name || "Bedrock InvokeModelWithResponseStream"; },
        paletteLabel: "Bedrock InvokeModelWithResponseStream"
    });

    RED.nodes.registerType("bedrock-listasyncinvokes", BedrockListAsyncInvokesNode, {
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
        category: 'Amazon Bedrock',
        label: function() { return this.name || "Bedrock ListAsyncInvokes"; },
        paletteLabel: "Bedrock ListAsyncInvokes"
    });

    RED.nodes.registerType("bedrock-startasyncinvoke", BedrockStartAsyncInvokeNode, {
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
        category: 'Amazon Bedrock',
        label: function() { return this.name || "Bedrock StartAsyncInvoke"; },
        paletteLabel: "Bedrock StartAsyncInvoke"
    });

    RED.nodes.registerType("bedrock-createinvocation", BedrockCreateInvocationNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock CreateInvocation"; },
        paletteLabel: "Bedrock CreateInvocation"
    });

    RED.nodes.registerType("bedrock-createsession", BedrockCreateSessionNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock CreateSession"; },
        paletteLabel: "Bedrock CreateSession"
    });

    RED.nodes.registerType("bedrock-deleteagentmemory", BedrockDeleteAgentMemoryNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock DeleteAgentMemory"; },
        paletteLabel: "Bedrock DeleteAgentMemory"
    });

    RED.nodes.registerType("bedrock-deletesession", BedrockDeleteSessionNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock DeleteSession"; },
        paletteLabel: "Bedrock DeleteSession"
    });

    RED.nodes.registerType("bedrock-endsession", BedrockEndSessionNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock EndSession"; },
        paletteLabel: "Bedrock EndSession"
    });

    RED.nodes.registerType("bedrock-generatequery", BedrockGenerateQueryNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock GenerateQuery"; },
        paletteLabel: "Bedrock GenerateQuery"
    });

    RED.nodes.registerType("bedrock-getagentmemory", BedrockGetAgentMemoryNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock GetAgentMemory"; },
        paletteLabel: "Bedrock GetAgentMemory"
    });

    RED.nodes.registerType("bedrock-getinvocationstep", BedrockGetInvocationStepNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock GetInvocationStep"; },
        paletteLabel: "Bedrock GetInvocationStep"
    });

    RED.nodes.registerType("bedrock-getsession", BedrockGetSessionNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock GetSession"; },
        paletteLabel: "Bedrock GetSession"
    });

    RED.nodes.registerType("bedrock-invokeagent", BedrockInvokeAgentNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock InvokeAgent"; },
        paletteLabel: "Bedrock InvokeAgent"
    });

    RED.nodes.registerType("bedrock-invokeflow", BedrockInvokeFlowNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock InvokeFlow"; },
        paletteLabel: "Bedrock InvokeFlow"
    });

    RED.nodes.registerType("bedrock-invokeinlineagent", BedrockInvokeInlineAgentNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock InvokeInlineAgent"; },
        paletteLabel: "Bedrock InvokeInlineAgent"
    });

    RED.nodes.registerType("bedrock-listinvocationsteps", BedrockListInvocationStepsNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock ListInvocationSteps"; },
        paletteLabel: "Bedrock ListInvocationSteps"
    });

    RED.nodes.registerType("bedrock-listinvocations", BedrockListInvocationsNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock ListInvocations"; },
        paletteLabel: "Bedrock ListInvocations"
    });

    RED.nodes.registerType("bedrock-listsessions", BedrockListSessionsNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock ListSessions"; },
        paletteLabel: "Bedrock ListSessions"
    });

    RED.nodes.registerType("bedrock-listtagsforresource", BedrockListTagsForResourceNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock ListTagsForResource"; },
        paletteLabel: "Bedrock ListTagsForResource"
    });

    RED.nodes.registerType("bedrock-optimizeprompt", BedrockOptimizePromptNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock OptimizePrompt"; },
        paletteLabel: "Bedrock OptimizePrompt"
    });

    RED.nodes.registerType("bedrock-putinvocationstep", BedrockPutInvocationStepNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock PutInvocationStep"; },
        paletteLabel: "Bedrock PutInvocationStep"
    });

    RED.nodes.registerType("bedrock-rerank", BedrockRerankNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock Rerank"; },
        paletteLabel: "Bedrock Rerank"
    });

    RED.nodes.registerType("bedrock-retrieveandgenerate", BedrockRetrieveAndGenerateNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock RetrieveAndGenerate"; },
        paletteLabel: "Bedrock RetrieveAndGenerate"
    });

    RED.nodes.registerType("bedrock-retrieveandgeneratestream", BedrockRetrieveAndGenerateStreamNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock RetrieveAndGenerateStream"; },
        paletteLabel: "Bedrock RetrieveAndGenerateStream"
    });

    RED.nodes.registerType("bedrock-retrieve", BedrockRetrieveNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock Retrieve"; },
        paletteLabel: "Bedrock Retrieve"
    });

    RED.nodes.registerType("bedrock-tagresource", BedrockTagResourceNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock TagResource"; },
        paletteLabel: "Bedrock TagResource"
    });

    RED.nodes.registerType("bedrock-untagresource", BedrockUntagResourceNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock UntagResource"; },
        paletteLabel: "Bedrock UntagResource"
    });

    RED.nodes.registerType("bedrock-updatesession", BedrockUpdateSessionNode, {
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
        category: 'Amazon Bedrock Agent',
        label: function() { return this.name || "Bedrock UpdateSession"; },
        paletteLabel: "Bedrock UpdateSession"
    });
}