const {
 DynamoDBDocumentClient,
 PutCommand
} = require("@aws-sdk/lib-dynamodb");

const client =
require("../config/dynamodb");

const docClient =
DynamoDBDocumentClient.from(client);

async function saveStudent(profile) {

 const info =
 profile.response.generalinformation;

 await docClient.send(
   new PutCommand({
     TableName:"students",

     Item:{
       registrationNo:
       info.registrationno,

       studentName:
       info.studentname,

       branch:
       info.branch,

       semester:
       info.semester,

       batch:
       info.batch
     }
   })
 );
}

module.exports = {
 saveStudent
};