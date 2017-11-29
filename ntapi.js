var request = require('request')
var fs = require('fs')
var path = require('path')
var bots = require('./bots')

class Bot{
	constructor(botname){
		Object.assign(this,bots[botname])
	}
	save(cb){
		bots[this.username] = this
		fs.writeFile(path.join(__dirname,'bots.json'),JSON.stringify(bots),cb)
	}
	login(cb){
		var j = request.jar()
		request.post({
			url: `https://www.nitrotype.com/api/login`,
			form: {
				username:this.username,
				password:this.password
			},
			jar: j
		}, (err, res, body) => {
			if (err || !(body = JSON.parse(body)) || !body.success) return cb(err||body)
			this.cookies = j.getCookieString('https://www.nitrotype.com')
			this.uhash = decodeURIComponent(this.getCookie('ntuserrem'))
			Object.assign(this,body.data)
			this.save(err => {
				cb(err,this.uhash)
			})
		})
	}
	getCookie(cookieName) {
		var parts = ("; " + this.cookies).split("; " + cookieName + "=")
		if (parts.length == 2) return parts.pop().split(";").shift()
	}
	pay(userID,amount,cb) {
		request.post({
			url: `https://www.nitrotype.com/api/friends/${userID}/sendcash`,
			jar: this.getCookieJar(),
			form: {
				amount: Math.round(amount),
				password: this.password,
				playersCash: this.money,
				recipient: userID,
				feePercent: 0,
				uhash: this.uhash
			}
		}, (err, res, body) => {
			if (err || !(body = JSON.parse(body)) || !body.success) return cb(err||JSON.stringify(body))
			this.money = body.data.money
			this.moneySpent = body.data.moneySpent
			this.save(err => {
				cb(err,body.data)
			})
		})
	}
	getCookieJar(){
		var j = request.jar()
		this.cookies.split('; ').forEach(cookie => {
			j.setCookie(request.cookie(cookie),'https://www.nitrotype.com')
		})
		return j
	}
	kick(userID,cb){
		request.post({
			url: `https://www.nitrotype.com/api/team-members/${userID}/remove`,
			jar: this.getCookieJar(),
			form: {
				uhash: this.uhash
			}
		}, (err, res, body) => {
			if (err || !(body = JSON.parse(body)) || !body.success) return cb(err||JSON.stringify(body))
			cb(null,body.data)
		})
	}
	accept(userID,cb){
		request.post({
			url: `https://www.nitrotype.com/api/team-requests/${userID}/accept`,
			jar: this.getCookieJar(),
		}, (err, res, body) => {
			if (err || !(body = JSON.parse(body)) || !body.success) return cb(err||JSON.stringify(body))
			cb(null,body.data)
		})
	}
	deny(userID,cb){
		request.post({
			url: `https://www.nitrotype.com/api/team-requests/${userID}/deny`,
			jar: this.getCookieJar(),
		}, (err, res, body) => {
			if (err || !(body = JSON.parse(body)) || !body.success) return cb(err||JSON.stringify(body))
			cb(null,body.data)
		})
	}
	updateMoney(cb){
		request(`https://www.nitrotype.com/racer/${this.username}`,(err, res, body) => {
			if (err) return cb(err)
			fs.writeFileSync('temp.html',body)
			this.money = +body.match(/"money":(\d+)/)[1]
			this.save(err => {
				cb(err,this.money)
			})
		})
	}
	getApplications(cb){
		request.get({
			url: `https://www.nitrotype.com/api/teams/applications?uhash=${this.uhash}`,
			jar: this.getCookieJar(),
		}, (err, res, body) => {
			if (err || !(body = JSON.parse(body)) || !body.success) return cb(err||JSON.stringify(body))
			cb(null,body.data)
		})
	}
}

module.exports.getBot = function(botname){
	return new Bot(botname)
}

module.exports.getRandomBot = function(except){
	except = except || []
	var botnames = Object.keys(bots).filter(n => !except.includes(n))
	return new Bot(botnames[Math.floor(Math.random()*botnames.length)])
}