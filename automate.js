var Nightmare = require('nightmare')
require('nightmare-window-manager')(Nightmare);
var path = require('path')
var auth = require('./auth')
var nightmare = new Nightmare({
	openDevTools: true,
	webPreferences: {
    preload: path.resolve(__dirname,'nitrohack.js'),
		webSecurity: false,
  },
	waitTimeout: 2*60*1000,
	executionTimeout: 2*60*1000,
	show:true
})
var roundsLeft = 330 + Math.floor(Math.random() * 20)

function login(){
	return nightmare
		.goto('https://www.nitrotype.com/race')
		.click('.login-link')
		.insert('[name=username]',auth.username)
		.insert('[name=password]',auth.password)
		.click('.login-form .submit')
		.then(go)
		.catch(login)
}

function go(){
	return nightmare
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
		.then(money => {
			console.log(money)
			return goAgain()
		})
		.catch(err => {
			console.error(err)
			return goAgain()
		})
}

function goAgain(){
	if(--roundsLeft){
		return nightmare.refresh().then(go)
	} else {
		return nightmare.end()
	}
}

login()