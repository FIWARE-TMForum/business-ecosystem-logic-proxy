require("chromedriver");

describe('Integration tests', function () {
    
    var webdriver = require('selenium-webdriver'),
	By = webdriver.By,
	until = webdriver.until;
    
    var driver = new webdriver.Builder()
	.forBrowser('chrome')
	.build();
    
    describe('User logs in, updates his/her info, creates a new category, uploads a new product and creates an offering containing that product', function () {
	driver.get('http://localhost:8000/#/offering');
	
	it('Should be able to log in with a correct username and password', function (done) {
	    driver.wait(until.elementLocated(By.linkText('Sign in')));
	    driver.findElement(By.linkText('Sign in')).click();
	    driver.wait(until.elementLocated(By.id('id_username')));
	    
	    driver.findElement(By.id('id_username')).sendKeys('patata@mailinator.com');
	    driver.findElement(By.id('id_password')).sendKeys('test');
	    driver.findElement(By.className('btn btn-primary pull-right')).click();
	    driver.getTitle().then(function (title) {
		expect(title).toBe('Biz Ecosystem');
		// expect(driver.findElement(By.className('dropdown')))
		done();
	    });

	});

	it('Should be able to update his/her info', function(done) {
	    driver.findElement(By.className('dropdown-toggle has-stack')).click();
	    driver.findElement(By.id('Settings')).click();
	    
	    // Change some of the values
	    var fieldName = driver.wait(until.elementLocated(By.name('firstName')));
	    fieldName.clear();
	    fieldName.sendKeys('testName');
	    driver.findElement(By.name('lastName')).clear();
	    driver.findElement(By.name('lastName')).sendKeys('testSurName');
	    driver.findElement(By.className('btn btn-success')).click();
	    driver.getTitle().then(function (title) {
		expect(title).toBe('Biz Ecosystem');
		// expect(driver.findElement(By.className('dropdown')))
		done();
	    });
	});
	
	// Lets create some category hierarchy
	// Go to Admin page
	driver.findElement(By.className('dropdown-toggle has-stack')).click();
	driver.findElement(By.id('Admin')).click();
	
	// Create a new parent category
	driver.wait(until.elementLocated(By.className('btn btn-success')));
	driver.findElement(By.className('btn btn-success')).click();
	
	var catName = driver.wait(until.elementLocated(By.name('name')));
	catName.sendKeys('test');
	driver.findElement(By.name('description')).sendKeys('A testing description');
	
    })
    driver.quit();
})




