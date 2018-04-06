# Serverless Data Flow Sequencing with Watson Data API and IBM Cloud Functions

![IBM Cloud Function Logs](https://github.ibm.com/DCummin3/data-flow-run-sequence-function/blob/master/images/IBMCloudFunctionLogs.JPG)

In a [previous tutorial](https://medium.com/ibm-watson/using-shell-scripts-to-control-data-flows-created-in-watson-applications-f7de2e265f1f), you saw how data flows could be run one after another by polling using a simple shell script. This tutorial demonstrates how to deploy the same functionality as a serverless action. IBM Cloud Functions enable you to deploy a simple, repeatable function and run it periodically by using the `alarm` package.

For example, if you have two data flows (`data_flow_1` and `data_flow_2`) and you always want to run `data_flow_2` after `data_flow_1` completes, you can write an IBM Cloud Function to check the status of the latest `data_flow_1` run. If the status is completed, then the function should start a run of `data_flow_2`.

## Creating a Node.js function

First, clone this repository and run `npm install` to install the dependencies. Once this completes, be sure to add your project ID and the IDs of the two data flows you want to monitor and run to `index.js`, for example:

```javascript
// Parameters
const projectId = 'c2254fed-404d-4905-9b8c-5102f195cc0d';
const dataFlowId1 = '37bd30f0-dd3f-4052-988d-69c8fb2bf40a'; // Data Flow Ref to check status of latest run
const dataFlowId2 = 'd31116c7-854f-404c-9e7a-de274a8bb2d6'; // Data Flow Ref to trigger run for
```

The `main` function is the one that will be called each time the action is invoked. The function creates a new authentication token, retrieves the latest run for `dataFlowId1`, and then either creates a new `dataFlowId2` run or simply returns, depending on the `state` and `completed_date`.

We've configured the function to run every 20 seconds so we will *only* start a new run for `dataFlowId2` if the run completed in the last 20 seconds. This is to avoid starting `dataFlowId2` every time we retrieve the latest finished run for `dataFlowId1`.

```javascript
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
```

To deploy this node.js function to IBM Cloud, package it as a `.zip` archive, including the `node_modules`, `index.js`, and `package.json` files.

## Getting started with IBM Cloud Functions CLI

First, follow the instructions [here](https://console.bluemix.net/openwhisk/learn/cli) to install the IBM Cloud Functions CLI.

In a terminal window, upload the .zip file containing the node.js action as a Cloud Function by using the following command:
`bx wsk action create packageAction --kind nodejs:default action.zip`

To manually invoke the action, use the following command:
`bx wsk action invoke --blocking --result packageAction`

## Trigger: every-20-seconds

This trigger uses the built-in alarm package feed to fire events every 20 seconds. This is specified through cron syntax in the cron parameter.  _[Optional] The maxTriggers parameter ensures that it only fires for five minutes (15 times), rather than indefinitely._

Create the trigger with the following command:
`bx wsk trigger create every-20-seconds --feed  /whisk.system/alarms/alarm --param cron "*/20 * * * * *" --param maxTriggers 15`

## Rule: invoke-periodically

This rule shows how the every-20-seconds trigger can be declaratively mapped to the packageAction.

Create the rule with the following command:
`bx wsk rule create invoke-periodically every-20-seconds packageAction`

Next, open a terminal window to start polling the activation log. The `console.log` statements in the action will be logged here. You can stream them with the following command:
`bx wsk activation poll`

## Monitoring logs

Before running your data flow, you should see entries similar to the following ones:

```Javascript
Activation: 'packageAction' (4bdd001fbdb24f639d001fbdb2df63e4)
[
    "2018-03-19T13:57:20.904296323Z stdout: ",
    "2018-03-19T13:57:20.904339321Z stdout: Retrieving auth token...",
    "2018-03-19T13:57:20.904347825Z stdout: API Token: It8aNFblEJUvdfYRinu0sxHJu0VU3qXgDH-MgOo-Dfdh",
    "2018-03-19T13:57:20.904355036Z stdout: Auth URL: https://iam.ng.bluemix.net/oidc/token",
    "2018-03-19T13:57:21.451169088Z stdout: 200 OK",
    "2018-03-19T13:57:21.451238184Z stdout: ",
    "2018-03-19T13:57:21.451246831Z stdout: Retrieving latest data flow run...",
    "2018-03-19T13:57:21.45125334Z  stdout: Data Flow Ref: 37bd30f0-dd3f-4052-988d-69c8fb2bf40a",
    "2018-03-19T13:57:21.451259309Z stdout: Data Flows API URL: https://api.dataplatform.ibm.com/v2/data_flows",
    "2018-03-19T13:57:21.695420014Z stdout: 200 OK",
    "2018-03-19T13:57:21.69547262Z  stdout: metadata.asset_id: e0e680a8-cd93-4941-967e-ba7cf527d060",
    "2018-03-19T13:57:21.69548302Z  stdout: entity.data_flow_ref: 37bd30f0-dd3f-4052-988d-69c8fb2bf40a",
    "2018-03-19T13:57:21.695492959Z stdout: entity.state: finished",
    "2018-03-19T13:57:21.695502161Z stdout: entity.summary.completed_date: 2018-03-19T13:30:51.956Z",
    "2018-03-19T13:57:21.695511553Z stdout: Lookback date: Mon Mar 19 2018 13:57:00 GMT+0000 (UTC)"
]

Activation: 'every-20-seconds' (25f660a484554d19b660a484558d1982)
[
    "{\"statusCode\":0,\"success\":true,\"activationId\":\"4bdd001fbdb24f639d001fbdb2df63e4\",\"rule\":\"dcummin3@uk.ibm.com_dev/invoke-periodically\",\"action\":\"dcummin3@uk.ibm.com_dev/packageAction\"}"
]
```

The first entry shows the IAM Authorization token being obtained, retrieving the data flow run, and then returning because the `entity.summary.completed_date` is earlier than the lookback date.

At this point, run `dataFlowId1` from either Watson Studio or Watson Knowledge Catalog.

```Javascript
Activation: 'packageAction' (785f0f7deff64f929f0f7deff6af92e5)
[
    "2018-03-19T13:58:01.248068497Z stdout: ",
    "2018-03-19T13:58:01.248105245Z stdout: Retrieving auth token...",
    "2018-03-19T13:58:01.248116092Z stdout: API Token: It8aNFblEJUvdfYRinu0sxHJu0VU3qXgDH-MgOo-Dfdh",
    "2018-03-19T13:58:01.248130147Z stdout: Auth URL: https://iam.ng.bluemix.net/oidc/token",
    "2018-03-19T13:58:01.518279198Z stdout: 200 OK",
    "2018-03-19T13:58:01.518363734Z stdout: ",
    "2018-03-19T13:58:01.518382448Z stdout: Retrieving latest data flow run...",
    "2018-03-19T13:58:01.518422935Z stdout: Data Flow Ref: 37bd30f0-dd3f-4052-988d-69c8fb2bf40a",
    "2018-03-19T13:58:01.518439899Z stdout: Data Flows API URL: https://api.dataplatform.ibm.com/v2/data_flows",
    "2018-03-19T13:58:01.772386085Z stdout: 200 OK",
    "2018-03-19T13:58:01.772438713Z stdout: metadata.asset_id: 1a04d3a3-60d8-4a98-8b4b-bca003d4f87b",
    "2018-03-19T13:58:01.772459792Z stdout: entity.data_flow_ref: 37bd30f0-dd3f-4052-988d-69c8fb2bf40a",
    "2018-03-19T13:58:01.772474712Z stdout: entity.state: running",
    "2018-03-19T13:58:01.773826622Z stdout: entity.summary.completed_date: undefined",
    "2018-03-19T13:58:01.774395466Z stdout: Lookback date: Mon Mar 19 2018 13:57:41 GMT+0000 (UTC)"
]

Activation: 'every-20-seconds' (97d6e57350bf4bf396e57350bf7bf333)
[
    "{\"statusCode\":0,\"success\":true,\"activationId\":\"785f0f7deff64f929f0f7deff6af92e5\",\"rule\":\"dcummin3@uk.ibm.com_dev/invoke-periodically\",\"action\":\"dcummin3@uk.ibm.com_dev/packageAction\"}"
]
```

This entry is very similar but in this case, the `entity.state` is running so the function returns again.

```Javascript
Activation: 'packageAction' (5f243e7e12194de0a43e7e1219cde056)
[
    "2018-03-19T13:58:20.8983174Z   stdout: ",
    "2018-03-19T13:58:20.89838054Z  stdout: Retrieving auth token...",
    "2018-03-19T13:58:20.898411376Z stdout: API Token: It8aNFblEJUvdfYRinu0sxHJu0VU3qXgDH-MgOo-Dfdh",
    "2018-03-19T13:58:20.898422509Z stdout: Auth URL: https://iam.ng.bluemix.net/oidc/token",
    "2018-03-19T13:58:21.322766188Z stdout: 200 OK",
    "2018-03-19T13:58:21.322834667Z stdout: ",
    "2018-03-19T13:58:21.322849817Z stdout: Retrieving latest data flow run...",
    "2018-03-19T13:58:21.323166185Z stdout: Data Flow Ref: 37bd30f0-dd3f-4052-988d-69c8fb2bf40a",
    "2018-03-19T13:58:21.323188785Z stdout: Data Flows API URL: https://api.dataplatform.ibm.com/v2/data_flows",
    "2018-03-19T13:58:27.603144607Z stdout: 200 OK",
    "2018-03-19T13:58:27.603199759Z stdout: metadata.asset_id: 1a04d3a3-60d8-4a98-8b4b-bca003d4f87b",
    "2018-03-19T13:58:27.603212482Z stdout: entity.data_flow_ref: 37bd30f0-dd3f-4052-988d-69c8fb2bf40a",
    "2018-03-19T13:58:27.603574172Z stdout: entity.state: finished",
    "2018-03-19T13:58:27.603589014Z stdout: entity.summary.completed_date: 2018-03-19T13:58:17.127Z",
    "2018-03-19T13:58:27.603997587Z stdout: Lookback date: Mon Mar 19 2018 13:58:00 GMT+0000 (UTC)",
    "2018-03-19T13:58:27.604389545Z stdout: ",
    "2018-03-19T13:58:27.60441344Z  stdout: Running data flow...",
    "2018-03-19T13:58:27.604442005Z stdout: Data Flow Ref: d31116c7-854f-404c-9e7a-de274a8bb2d6",
    "2018-03-19T13:58:27.604460651Z stdout: Data Flows API URL: https://api.dataplatform.ibm.com/v2/data_flows",
    "2018-03-19T13:58:28.891179724Z stdout: 201 Created",
    "2018-03-19T13:58:28.891218767Z stdout: metadata.asset_id: 8c58425a-d8ea-41e5-b064-9747f0d771b0",
    "2018-03-19T13:58:28.891227744Z stdout: entity.data_flow_ref: d31116c7-854f-404c-9e7a-de274a8bb2d6",
    "2018-03-19T13:58:28.891533309Z stdout: entity.state: starting"
]

Activation: 'every-20-seconds' (4443d803d6a44d6883d803d6a46d6817)
[
    "{\"statusCode\":0,\"success\":true,\"activationId\":\"5f243e7e12194de0a43e7e1219cde056\",\"rule\":\"dcummin3@uk.ibm.com_dev/invoke-periodically\",\"action\":\"dcummin3@uk.ibm.com_dev/packageAction\"}"
]

```
In this entry, you can see that the run for the data flow with an ID of `37bd30f0-dd3f-4052-988d-69c8fb2bf40a` finished so the data flow with an ID of `d31116c7-854f-404c-9e7a-de274a8bb2d6` starts.

