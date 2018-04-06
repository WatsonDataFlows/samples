'use strict';

// imports
const rest = require('restler');

// IBM Cloud API Token
const bmApiToken = '<replace-with-ibm-cloud-api-token>';

// URLs
const authUrl = 'https://iam.ng.bluemix.net/oidc/token';
const dataFlowsApiUrl = 'https://api.dataplatform.ibm.com/v2/data_flows';

// Parameters
const projectId = '<replace-with-project-id>';
const dataFlowId1 = '<replace-with-data-flow-id-1>'; // Data Flow Ref to check status of latest run
const dataFlowId2 = '<replace-with-data-flow-id-2>'; // Data Flow Ref to trigger run for

// Look back window in MS 
const lookbackWindow = 20000;

// REST options
const iamOptions = {
    username: 'Yng6Yng=',
    timeout: 120000,
    headers : {
      'User-Agent' : 'nodejs-wdpc (Node.js ' +  process.version + ')'
    },
    method: 'POST',
    data: {
          apikey: bmApiToken,
          grant_type: 'urn:ibm:params:oauth:grant-type:apikey'
    }
};

const dataFlowOptions = {
    timeout: 120000,
    headers : {
      'Authorization': authToken
    },
    method: 'GET',
};

// IAM Authorization Token
var authToken = null;

// Main function
function main(params) {
    // Time now
    var now = new Date();
    return new Promise(function(resolve, reject) {
        return authenticate(function(err) {
            if (err) {
                console.log(err);
                reject({error: err});
            }
            var date = new Date();
            getLatestRun(dataFlowId1, projectId, function(err, run) {
                if (err) {
                    reject({error: err});
                } else if (run != null) {
                    var lookbackDate = new Date(now - lookbackWindow);
                    console.log("Lookback date: " + lookbackDate);
                    if (run.entity.summary && run.entity.state === 'finished') {
                        if (new Date(run.entity.summary.completed_date) > lookbackDate) {
                            runDataFlow(dataFlowId2, projectId, function(err, newRun) {
                                resolve({ 
                                    message: "Invoked at: " + date.toLocaleString(),
                                    dataFlowRunId: newRun.metadata.asset_id, 
                                    dataFlowRef: newRun.entity.data_flow_ref, 
                                    state: newRun.entity.state});
                            });
                        } else {
                            resolve({ 
                                message: "Invoked at: " + date.toLocaleString(), 
                                dataFlowRunId: run.metadata.asset_id, 
                                dataFlowRef: run.entity.data_flow_ref, 
                                state: run.entity.state, 
                                completedDate: run.entity.summary.completed_date});
                        }
                    } else {
                        resolve({ 
                            message: "Invoked at: " + date.toLocaleString(), 
                            dataFlowRunId: run.metadata.asset_id, 
                            dataFlowRef: run.entity.data_flow_ref, 
                            state: run.entity.state,});
                    }
                } else {
                    resolve({ message: "Invoked at: " + date.toLocaleString(), authToken: authToken});
                }

            });

        });
    });
};

// Authenticate with IAM
function authenticate(callback) {
    console.log("\nRetrieving auth token...");
    console.log("API Token: " + bmApiToken);
    console.log("Auth URL: " + authUrl);
    rest.request(authUrl,
        iamOptions).on('complete',
         function(data, response) {
            //console.log(response.statusCode + " " + response.statusMessage + " " +  JSON.stringify(data));
            console.log(response.statusCode + " " + response.statusMessage);

            if(response.statusCode === 200) {
                authToken = JSON.parse(data).access_token;
                return callback();
            }
            else {
                authToken = null;
                //return callback({'errorCode': data.errorCode,'errorMessage': data.errorMessage});
                response.statusMessage = response.statusMessage + ' (' + authUrl + ' returned error code: ' + data.errorCode + ' and error message: ' + data.errorMessage + ')';
                return callback(response);
            }
         });
};

// Retrieve the latest run for a given data flow in a project
function getLatestRun(dataFlowId, projectId, callback) {
    console.log("\nRetrieving latest data flow run...");
    console.log("Data Flow Ref: " + dataFlowId);
    console.log("Data Flows API URL: " + dataFlowsApiUrl);
    
    var listRunsUrl = dataFlowsApiUrl + '/' + dataFlowId + '/runs?project_id=' + projectId + '&limit=1';

    var options = dataFlowOptions;
    options.headers.Authorization = 'bearer ' + authToken;

    rest.request(listRunsUrl,
        options).on('complete',
         function(data, response) {
            //console.log(response.statusCode + " " + response.statusMessage + " " +  JSON.stringify(data));
            console.log(response.statusCode + " " + response.statusMessage);

            if(response.statusCode === 200) {
                var run = JSON.parse(data).runs[0];
                console.log('metadata.asset_id: ' + run.metadata.asset_id);
                console.log('entity.data_flow_ref: ' + run.entity.data_flow_ref);
                console.log('entity.state: ' + run.entity.state);
                if (run.entity.summary && run.entity.summary.completed_date) {
                    console.log('entity.summary.completed_date: ' + run.entity.summary.completed_date);
                }
                return callback(null, run);
            }
            else {
                //return callback({'errorCode': data.errorCode,'errorMessage': data.errorMessage});
                response.statusMessage = response.statusMessage + ' (' + listRunsUrl + ' returned error code: ' + data.errorCode + ' and error message: ' + data.errorMessage + ')';
                return callback(response, null);
            }
         });
};

// Run a data flow in a project
function runDataFlow(dataFlowId, projectId, callback) {
    console.log("\nRunning data flow...");
    console.log("Data Flow Ref: " + dataFlowId);
    console.log("Data Flows API URL: " + dataFlowsApiUrl);
    
    var runDataFlowUrl = dataFlowsApiUrl + '/' + dataFlowId + '/runs?project_id=' + projectId;

    var options = JSON.parse(JSON.stringify(dataFlowOptions));
    options.headers.Authorization = 'bearer ' + authToken;
    options.headers['Content-Type'] = 'application/json';
    options.method = 'POST';
    options.data = '{}';

    rest.request(runDataFlowUrl,
        options).on('complete',
         function(data, response) {
            //console.log(response.statusCode + " " + response.statusMessage + " " +  JSON.stringify(data));
            console.log(response.statusCode + " " + response.statusMessage);

            if(response.statusCode === 201) {
                var run = JSON.parse(data);
                console.log('metadata.asset_id: ' + run.metadata.asset_id);
                console.log('entity.data_flow_ref: ' + run.entity.data_flow_ref);
                console.log('entity.state: ' + run.entity.state);
                return callback(null, run);
            }
            else {
                //return callback({'errorCode': data.errorCode,'errorMessage': data.errorMessage});
                response.statusMessage = response.statusMessage + ' (' + runDataFlowUrl + ' returned error code: ' + data.errorCode + ' and error message: ' + data.errorMessage + ')';
                return callback(response, null);
            }
         });
};


// For local testing
// var mainResponse = main(null);
// console.log(mainResponse);
// setTimeout(function() {
//     console.log(mainResponse);
// }, 5000);

exports.main = main;
