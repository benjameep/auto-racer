var Nightmare = require('nightmare')
require('nightmare-window-manager')(Nightmare);
var path = require('path')
var auth = require('./auth')
var nightOptions = {
	openDevTools: true,
	webPreferences: {
    preload: path.resolve(__dirname,'nitrohack.js'),
		webSecurity: false,
  },
	waitTimeout: 1.5*60*1000,
	executionTimeout: 1.5*60*1000,
	show:process.argv.includes('--show') || process.argv.includes('-s')
}

class Bot{
	constructor(arg){
		this.roundsLeft = 300 + Math.floor(Math.random() * 20)
		this.username = isNaN(arg)?arg:auth.username[arg]
		this.nightmare = new Nightmare(nightOptions)
		this.login()
	}
	login(){
		return this.nightmare
			.goto('https://www.nitrotype.com/race')
			.click('.login-link')
			.insert('[name=username]',this.username)
			.insert('[name=password]',auth.password)
			.click('.login-form .submit')
			.then(() => this.go.call(this))
			.catch(() => this.login.call(this))
	}

	go(){
		return this.nightmare
			.wait(5000)
			.evaluate(() => {
				var place = {
					"2200":"1st",
					"2090":"2nd",
					"1980":"3rd",
					"1870":"4th",
					"1760":"5th",
				}
				return new Promise((resolve,reject) => {
					setInterval(() => {
						if($('.race-results').length)
							resolve([
								userInfo.money,
								racers[userInfo.userID].money,
								place[racers[userInfo.userID].place],
								$('.you .stats span:last-child').text().replace(/\D/g,''),
								userInfo.avgSpeed,
								userInfo.sessionRaces,
								new Date().toLocaleTimeString(),
							].join('\t'))
						if($('.popup-race-error').length)
							reject($('.popup-race-error h1').text())
					},1000)
				})
			})
			.then(log => {
				console.log(this.username+'\t'+log)
				return this.goAgain.call(this)
			})
			.catch(err => {
				console.error(err)
				return this.goAgain.call(this)
			})
	}

	goAgain(){
		if(--this.roundsLeft){
			return this.nightmare.refresh().then(this.go.call(this))
		} else {
			return this.nightmare.end()
		}
	}
}

function init(){
	var args = process.argv.filter(n => !n.match(/^-/)).slice(2)
	if(args.length)
		args.forEach(arg => new Bot(arg))
	else
		new Bot(0)
}

init()