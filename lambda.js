//code based on aws dev samples
//SIRINI KARUNADASA 7/24/2021

var Promise=require('bluebird')
var aws=require("aws-sdk")
aws.config.setPromisesDependency(Promise)
aws.config.region=process.env.AWS_REGION

var s3=new aws.S3()
var lambda=new aws.Lambda()
var stride=parseInt(process.env.STRIDE)
var _=require('lodash')
var start=require('./lib/start')
var step=require('./lib/step')
var join=require('./lib/join')
var clean=require('./lib/clean')

exports.step=function(event,context,cb){
    console.log("step")
    console.log("Request",JSON.stringify(event,null,2))
    var Bucket=event.Records[0].s3.bucket.name
    var Key=decodeURI(event.Records[0].s3.object.key)
    var VersionId=_.get(event,"Records[0].s3.object.versionId")
    console.log(Bucket,Key) 
    
    s3.waitFor('objectExists',{Bucket,Key,VersionId}).promise()
    .then(()=>s3.getObject({Bucket,Key,VersionId}).promise())
    .then(x=>JSON.parse(x.Body.toString()))
    .then(function(config){
        var step_status_ignore = ['Error', 'Completed', 'Sync Complete', 'Parsing content JSON', 'Creating FAQ']
        if (step_status_ignore.includes(config.status)===false) {
            return Promise.try(function(){
                console.log("Config:",JSON.stringify(config,null,2))
                switch(config.status){
                    case 'Started':
                        return start(config);
                    case 'InProgress':
                        return step(config);
                    case "Join":
                        return join(config);
                    case "Clean":
                        return clean(config);
                }
            })
            .catch(error=>{
                console.log(error)
                config.status="Error"
                config.message=_.get(error,'message',JSON.stringify(error))
            })
            .then(()=>s3.putObject({Bucket,Key,Body:JSON.stringify(config)}).promise())
        }
    })
    .catch(cb)
}
