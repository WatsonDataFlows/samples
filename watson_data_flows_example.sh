#!/bin/sh
# Sample script working with IBM Watson Data - Data Flows APIs

####################################################################
#
# Helper functions to work with IBM Watson Data - Data Flows APIs
#
####################################################################

# Start a new run of a data flow
# ${1}=API key
get_bearer_token() {
  echo "Authenticating"
  BEARER=`curl -s -X POST -H "Content-Type: application/x-www-form-urlencoded" -H "Accept: application/json" --data-urlencode "grant_type=urn:ibm:params:oauth:grant-type:apikey" --data-urlencode "apikey=${1}" "https://iam.ng.bluemix.net/oidc/token"  |  python -c "import sys, json; print json.load(sys.stdin)['access_token']"`
}

# Start a new run of a data flow
# ${1}=bearer token
# ${2}=project ID
# ${3}=data flow ID
create_data_flow_run() {
  echo "Running data flow ${3} in project ${2}"
  DATA_FLOW_RUN_JSON=`curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${1}" ${API_URL}/v2/data_flows/${3}/runs?project_id=${2}`
  DATA_FLOW_RUN_ID=`echo ${DATA_FLOW_RUN_JSON} | python -c "import sys, json; print json.load(sys.stdin)['metadata']['asset_id']"`
  DATA_FLOW_RUN_STATE=`echo ${DATA_FLOW_RUN_JSON} | python -c "import sys, json; print json.load(sys.stdin)['entity']['state']"`
}

# Get a data flow run
# ${1}=bearer token
# ${2}=project ID
# ${3}=data flow ID
# ${4}=data flow run ID
get_data_flow_run() {
  DATA_FLOW_RUN_JSON=`curl -s -H "Authorization: Bearer ${1}" ${API_URL}/v2/data_flows/${3}/runs/${4}?project_id=${2}` 
  DATA_FLOW_RUN_STATE=`echo ${DATA_FLOW_RUN_JSON} | python -c "import sys, json; print json.load(sys.stdin)['entity']['state']"`
}

# Print stats for a completed data flow run
# ${1}=bearer token
# ${2}=project ID
# ${3}=data flow ID
# ${4}=data flow run ID
print_stats_for_data_flow_run() {
  get_data_flow_run ${1} ${2} ${3} ${4}
  DATA_FLOW_RUN_STARTED=`echo ${DATA_FLOW_RUN_JSON} | python -c "import sys, json; print json.load(sys.stdin)['metadata']['create_time']"`
  DATA_FLOW_RUN_COMPLETED=`echo ${DATA_FLOW_RUN_JSON} | python -c "import sys, json; print json.load(sys.stdin)['entity']['summary']['completed_date']"`
  DATA_FLOW_RUN_ROWS_READ=`echo ${DATA_FLOW_RUN_JSON} | python -c "import sys, json; print json.load(sys.stdin)['entity']['summary']['total_rows_read']"`
  DATA_FLOW_RUN_ROWS_WRITTEN=`echo ${DATA_FLOW_RUN_JSON} | python -c "import sys, json; print json.load(sys.stdin)['entity']['summary']['total_rows_written']"`
  echo "Stats for run ${4} state=${DATA_FLOW_RUN_STATE} started=${DATA_FLOW_RUN_STARTED} completed=${DATA_FLOW_RUN_COMPLETED} rows_read=${DATA_FLOW_RUN_ROWS_READ} rows_written=${DATA_FLOW_RUN_ROWS_WRITTEN}"
}

# Wait for data flow run to finish
# ${1}=bearer token
# ${2}=project ID
# ${3}=data flow ID
# ${4}=data flow run ID
wait_for_data_flow_run() {
  echo "Waiting for run ${4} of ${3} in project ${2} to complete..."
  get_data_flow_run ${1} ${2} ${3} ${4}
  echo "...state is ${DATA_FLOW_RUN_STATE}"
  while [[ "${DATA_FLOW_RUN_STATE}" != "finished" && "${DATA_FLOW_RUN_STATE}" != "error" && "${DATA_FLOW_RUN_STATE}" != "stopped" ]]
 do
   sleep 15
      get_data_flow_run ${1} ${2} ${3} ${4}
      echo "...state is ${DATA_FLOW_RUN_STATE}"
 done
  echo "Finished waiting for run ${4} with a final state of ${DATA_FLOW_RUN_STATE}"
}



####################################################################
#
# Example usage
#
####################################################################

API_URL=https://api.dataplatform.ibm.com

# authenticate
APIKEY=<!!replace me!!>
get_bearer_token ${APIKEY}

MY_PROJECT_ID=425372d3-df7c-4d5b-aafb-3c6960260232
MY_DATA_FLOW_1_ID=e656b54f-fb2f-4560-9f62-2ac7fe78b41d
MY_DATA_FLOW_2_ID=0c03670e-b8f4-49f2-a076-8e3e41d63270

# run the first flow and wait for it to finish
echo
echo "Starting flow 1..."
create_data_flow_run ${BEARER} ${MY_PROJECT_ID} ${MY_DATA_FLOW_1_ID}
MY_DATA_FLOW_1_RUN_ID=${DATA_FLOW_RUN_ID}
wait_for_data_flow_run ${BEARER} ${MY_PROJECT_ID} ${MY_DATA_FLOW_1_ID} ${MY_DATA_FLOW_1_RUN_ID}
print_stats_for_data_flow_run ${BEARER} ${MY_PROJECT_ID} ${MY_DATA_FLOW_1_ID} ${MY_DATA_FLOW_1_RUN_ID}

# run the second flow and wait for it to finish
echo
echo "Starting flow 2..."
create_data_flow_run ${BEARER} ${MY_PROJECT_ID} ${MY_DATA_FLOW_2_ID}
MY_DATA_FLOW_2_RUN_ID=${DATA_FLOW_RUN_ID}
wait_for_data_flow_run ${BEARER} ${MY_PROJECT_ID} ${MY_DATA_FLOW_2_ID} ${MY_DATA_FLOW_2_RUN_ID}
print_stats_for_data_flow_run ${BEARER} ${MY_PROJECT_ID} ${MY_DATA_FLOW_2_ID} ${MY_DATA_FLOW_2_RUN_ID}

echo
echo "Done"

exit
