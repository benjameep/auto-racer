const request = require('request')
const {
	URL
} = require('url')
const fs = require('fs')
const path = require('path')
const bots = require('./bots')
const async = require('async')
const keep = ['userID', 'username', 'displayName','level', 'title','cars', 'soldCars', 'totalCars', 'carID', 'carHueAngle', 'money', 'moneySpent', 'racesPlayed', 'avgSpeed', 'highestSpeed', 'country', 'gender', 'profileViews']
const baseURL = 'https://www.nitrotype.com'
class Bot {
	async create(bot) {
		if(typeof(bot) == 'object'){
			if(!bot.username || !bot.password){
				throw "Please include username,password in bot"
			}
			Object.assign(this,bot)
			this.getCookieJar()
			if(bot.speed){
				// try creating new bot
				try{
					await this.register()
					await this.qualify()
				} catch(e){
					// Only catching this one error
					if(e != 'This username is already in use')
						throw e
					await this.login()
				}
			} else {
				// Log in as bot
				await this.login()
			}
		} else {
			Object.assign(this, bots[bot])
			this.getCookieJar()
//			console.log(this.jar)
		}
		return this
	}
	save(data) {
		if (data) {
			Object.keys(data).filter(k => !keep.includes(k)).forEach(k => delete data[k])
			Object.assign(this, data)
		}
		bots[this.username] = Object.assign({},this)
		delete bots[this.username].jar
		fs.writeFileSync(path.join(__dirname, 'bots.json'), JSON.stringify(bots))
	}
	getCookieJar() {
		this.jar = request.jar()
		if(this.cookies){
			this.cookies.split('; ').forEach(cookie => {
				this.jar.setCookie(request.cookie(cookie), 'https://www.nitrotype.com')
			})
		}
	}
	getUhash(){
		if(this.jar){
			var cookies = this.jar._jar.toJSON().cookies
			var tryFind = cookies.filter(c => c.key =="ntuserrem")
			if(tryFind.length){
				return decodeURIComponent(tryFind[0].value)
			}
		}
	}
	call(path, options,saveCookies) {
		let method = typeof (options) == 'string' ? options : 'POST'
		options = typeof (options) == 'object' ? options : {}
		options.uhash = this.getUhash()
		let url = new URL(path, baseURL)
		if (method == 'GET' && options.uhash) {
			url.searchParams.append('uhash',options.uhash)
		}
		return new Promise((resolve, reject) => {
			request({
				url: url.href,
				method: method,
				jar: this.jar,
				form: method == 'POST' ? options : undefined
			}, (err, res, body) => {
				if (err) return reject(err)
				// Try parsing the body
				try {
					body = JSON.parse(body)
					if (!body.success) return reject(Object.values(body.data).join('|'))
				} catch (e) {
					return reject(body)
				}
				if(saveCookies){
					this.cookies = this.jar.getCookieString(baseURL)
				}
				resolve(body.data)
			})
		})
	}
	getCookie(cookieName) {
		var parts = ("; " + this.cookies).split("; " + cookieName + "=")
		if (parts.length == 2) return parts.pop().split(";").shift()
	}
	async login() {
		let data = await this.call('api/login', {
			username: this.username,
			password: this.password,
		},true)
		this.save(data)
	}
	async pay(userID, amount) {
		amount = amount || 1e5
		let data = await this.call(`api/friends/${userID}/sendcash`, {
			amount: Math.max(1e5, Math.round(amount)),
			password: this.password
		})
		this.save(data)
	}
	async check() {
		let data = await this.call(`api/achievements/check`, {
			ids: [...Array(600).keys()],
		})
		this.save(data.user)
	}
	async getTeamInvites(){
		let data = await this.call(`api/teams/search`,{
			invites:1
		})
		return data.invites
	}
	async acceptTeamInvite(teamID){
		await this.call(`api/teams/${teamID}/accept-invite`)
	}
	async applyToTeam(teamID){
		await this.call(`api/teams/${teamID}/apply`)
	}
	async kickFromTeam(userID) {
		await this.call(`api/team-members/${userID}/remove`)
	}
	async acceptToTeam(userID) {
		await this.call(`api/team-requests/${userID}/accept`)
	}
	async acceptAllToTeam(userID) {
		await this.call(`api/team-requests/accept-all`)
	}
	async denyToTeam(userID) {
		await this.call(`api/team-requests/${userID}/deny`)
	}
	async getTeamApplications() {
		let data = await this.call(`api/teams/applications`,'GET')
		return data
	}
	async buyCar(carID) {
		let data = await this.call(`api/cars/${carID}/buy`, {
			password: this.password,
			carID: carID
		})
		this.save(data)
	}
	async paintCar(carID, angle) {
		let data = await this.call(`api/cars/${carID}/paint`, {
			password: this.password,
			carID: carID,
			angle: angle
		})
		this.save(data)
	}
	async sellCar(carID){
		let data = await this.call(`api/cars/${carID}/sell`, {
			password: this.password,
			carID: carID,
		})
		this.save(data)
	}
	async useCar(carID){
		await this.call(`api/cars/${carID}/use`)
	}
	async getAffordableCars() {
		await this.check()
		let cars = await this.call(`api/cars`, 'GET')
		return cars
			.filter(c => c.purchasable) // is purchasable
			.filter(c => c.unlockLevel <= this.level) // we have a high enough rank
			.filter(c => c.price < this.money) // we have enough money
			.filter(c => !this.cars.map(n => n[0]).includes(c.carID)) // we don't already have it
	}
	async getSettings(){
		let data = await this.call(`api/settings`, 'GET')
		let temp = JSON.parse(JSON.stringify(data))
		this.save(data)
		return temp
	}
	async setSettings(settings){
		settings = settings || {}
		settings = Object.assign({
			displayName: this.displayName,
			gender: this.gender,
			country: this.country,
			title: this.title,
		},settings)
		console.log(settings)
		var data = await this.call(`api/settings/profile`, settings)
//		console.log(data)
	}
	async requestFriend(userID){
		await this.call(`api/friends/${userID}/request`)
	}
	async getFriendRequests(){
		var data = await this.call(`api/friend-requests`, 'GET')
		return data.requests
	}
	async getFriends(){
		var data = await this.call(`api/friends`, 'GET')
		return data.values.map(row => row.reduce((o,v,i) => {o[data.fields[i]] = v; return o},{}))
	}
	async acceptToFriends(userID){
		await this.call(`api/friend-requests/${userID}/accept`)
	}
	async acceptAllToFriends(userID){
		await this.call(`api/friend-requests/accept-all`)
	}
	async register(){
		let data = await this.call(`api/register`,{
			username:this.username,
			password:this.password
		},true)
		this.save(data)
	}
	async qualify(speed){
		let data = await this.call(`api/race/save-qualifying`,{
			speed: this.speed || speed,
			carID: [17,15,3][Math.floor(Math.random()*3)]
		},true)
		this.save(data)
	}
}


module.exports.get = botname => {
	let bot = new Bot()
	bot.create(botname)
	return bot
}
module.exports.cars = () => new Bot().call(`api/cars`, 'GET')
module.exports.team = team => new Bot().call(`api/teams/${team}`, 'GET')
// board:points|speed|hof
// time:season|monthly|weekly|daily
// grouping:racer|teams
// seasonID:0
module.exports.leaderboard = async function(board,time,grouping){
	let s = await new Bot().call(`api/scoreboard?board=${board}&time=${time}&grouping=${grouping}&seasonID=0`,'GET')
	return s.scores
}

// order: minLevel|minSpeed|members|createdStamp
module.exports.searchTeams = async function(order,pageSize,page){
	let t = await new Bot().call('api/teams/search',{
		minLevel:200,
		minSpeed:200,
		order: order,
		pageSize: pageSize,
		page: page,
	})
	return t.teams
}

module.exports.forEach = async function (iteri){
	return new Promise((resolve,reject) => {
		async.mapLimit(Object.keys(bots),10,(async (b,i,a) => {
			let bot = await module.exports.get(b)
			return await iteri(bot,i,a).catch(e => {throw bot.username+': '+e})
		}),(err,results) => {
			if(err){
				reject(err)
			} else {
				resolve(results)
			}
		})
	})
}

module.exports.all = Object.getOwnPropertyNames(Bot.prototype).reduce((all,task) => {
	all[task] = async function(){
		return module.exports.forEach(bot => bot[task](...arguments))
	}
	return all
},{});
