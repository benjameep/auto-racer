var fs = require('fs')
var path = require('path')
var async = require('async')
var bots = require('./bots')
var paid = require('./paid')
var ntapi = require('./ntapi')
var captain = ntapi.getBot('join4freemoney')
var usedUp = []

function getSponsor(){
	if(usedUp.length != Object.keys(bots).length){
		return ntapi.getRandomBot(usedUp)
	}
}

function pay(applicant,amount,cb){
	setTimeout(() => {
		var sponsor = getSponsor()
		var userID = applicant.userID
		if(!sponsor){
			console.error('Everyone is out of money')
			return cb('Everyone is out of money')
		}
		sponsor.pay(userID,amount,(err,data) => {
				if(err) {
						// this guy is out of money, lets try another
						console.log(sponsor.username,'had an error, trying another...')
						usedUp.push(sponsor.username)
						return pay(applicant,amount,cb)
				}
				console.log(sponsor.username,'paid',applicant.displayName||applicant.username,'| money left:',data.money)
				paid.push(userID)

				cb()
			})
	},5000)
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
		pay(applicant,100000,payerr => {
			captain.kick(userID,err => {
				if(payerr||err) return cb(payerr||err)
				cb()
			})
		})
	})
}

captain.getApplications((err,applications) => {
	if(err) return console.error(err)
	if(err) console.error(err)
	async.map(applications,acceptPayKick, err => {
		fs.writeFileSync(path.join(__dirname,'paid.json'),JSON.stringify(paid))
		if(err) console.error(err)
	})
})