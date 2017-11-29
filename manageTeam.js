var fs = require('fs')
var path = require('path')
var async = require('async')
var bots = require('./bots')
var paid = require('./paid')
var ntapi = require('./ntapi')
var captain = ntapi.getBot('join4freemoney')

function getRichestBotname(){
	return Object.keys(bots).reduce((richest,n) => bots[n].money > richest.money ? bots[n] : richest,{money:0}).username
}

function acceptPayKick(applicant,cb){
	var userID = applicant.userID
	if(paid.includes(userID)){
		captain.deny(userID,err => {
			if(err) return console.error(err)
			console.log('denied',userID,'already joined')
			cb()
		})
		return
	}
	captain.accept(userID,err => {
		if(err) return console.error(err)
		
		var richest = ntapi.getBot(getRichestBotname())
		if(richest.money < 100000) return 
		richest.pay(userID,100000,(err,data) => {
			if(err) return console.error(err)
			
			console.log(richest.username,'paid',applicant.displayName||applicant.username,'| money left:',data.money)
			paid.push(userID)
			
			captain.kick(userID,err => {
				if(err) return console.error(err)
				cb()
			})
		})
	})
}

captain.getApplications((err,applications) => {
	if(err) return console.error(err)
	async.mapLimit(applications,5,acceptPayKick, err => {
		fs.writeFileSync(path.join(__dirname,'paid.json'),JSON.stringify(paid))
		if(err) console.error(err)
	})
})