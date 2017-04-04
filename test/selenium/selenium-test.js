require("chromedriver");

describe('Integration tests', function () {

    
    var webdriver = require('selenium-webdriver'),
	By = webdriver.By,
	until = webdriver.until;
    
    var driver = new webdriver.Builder()
	.forBrowser('chrome')
	.build();

    function checkLogin(driver, done) {
	driver.wait(until.titleIs('Biz Ecosystem'));
	driver.wait(until.elementLocated(By.linkText('Sign in')));
	driver.findElement(By.linkText('Sign in')).click();
	driver.wait(until.elementLocated(By.id('id_username')));
	driver.findElement(By.id('id_username')).sendKeys(userProvider.id);
	driver.findElement(By.id('id_password')).sendKeys(userProvider.pass);
	driver.findElement(By.className('btn btn-primary pull-right')).click();
	driver.wait(until.titleIs('Biz Ecosystem'));
	var userLogged = driver.findElement(By.className("hidden-xs ng-binding"));
	userLogged.getText().then(function(name){
	    expect(name).toBe('testfiware');
	    done();
	});
    };
    
    fdescribe('User.', function () {
	
	beforeAll(function(done) {
	    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
	    done()
	});

	afterAll(function(done) {
	    driver.quit();
	    done();
	});

	userNormal = {id: 'patata@mailinator.com',
		      pass: 'test'};

	userProvider = {id: '58d5266e056d1@mailbox92.biz',
			pass: 'test'};
	

	/*
	  As far as i know, these test must be passed in this order as they emulate user possible actions.
	 */


	// Use this as a placeholder for new tests. Doing all the tests is horrible enough without worrying about what
	// html thing should be checked.
	// // TODO: Change this expect. This checks nothing
	// driver.getTitle().then(function (title) {
	//     expect(title).toBe('Biz Ecosystem');
	// });
	
	driver.get('http://localhost:8000/#/offering');
	
	it('Should be able to log in with a correct username and password', function (done) {
	    checkLogin(driver, done)
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
	    driver.wait(until.elementLocated(By.className('h4 text-dark-secondary')))
	    var nameInput = driver.wait(until.elementLocated(By.name('firstName')));
	    nameInput.getAttribute("value").then(function(firstName) {
		expect(firstName).toBe('testName');
		done();
	    })
	});

	it('Should be able to create a new category hierarchy', function(done) {
	    // Go to Admin page
	    driver.findElement(By.className('dropdown-toggle has-stack')).click();
	    driver.findElement(By.id('Admin')).click();
	    // Create a new parent category
	    driver.wait(until.elementLocated(By.className('btn btn-success')));
	    foundCats = !!driver.findElements(By.linkText('testCategory1'));
	    if (!foundCats) {
	    	driver.findElement(By.className('btn btn-success')).click();
	    	var catName = driver.wait(until.elementLocated(By.name('name')));
	    	catName.sendKeys('testCategory1');
	    	driver.findElement(By.name('description')).sendKeys('A testing description');
	    	driver.findElement(By.linkText('Next')).click();
	    	driver.wait(until.elementLocated(By.className('h4 text-dark-secondary')));
	    	driver.findElement(By.className('btn btn-warning')).click();
	    	// TODO: Change this expect. This checks nothing
	    	driver.getTitle().then(function (title) {
	    	    expect(title).toBe('Biz Ecosystem');
		    done();
	    	});
	    }else{
		done();
	    }
	});

	it('Will try to create a new catalog. If the catalog already exists, he should be able to update the status of that catalog', function(done) {
	    driver.findElement(By.className('btn btn-default z-depth-1')).click();
	    driver.wait(until.titleIs('Biz Ecosystem'));
	    driver.findElement(By.linkText('My stock')).click();
	    driver.wait(until.elementLocated(By.linkText('testCatalog19')));
	    var foundCatalog = !!driver.findElements(By.linkText('testCatalog22'));
	    if(foundCatalog){
		driver.findElement(By.linkText('testCatalog23')).click();
		// driver.wait(until.elementLocated(By.className('status-item status-launched')));
		// expect(name).toBe('testCatalog20');
		// var icon = driver.findElement(By.css("div.status-item.status-launched"));
		// driver
		//     .actions()
		//     .click(icon)
		//     .perform();
		driver.wait(until.elementLocated(By.className('status-item status-launched active')));
		driver.findElement(By.className('btn btn-success')).click();
		driver.wait(until.elementLocated(By.linkText('Home')));
		// var home = driver.findElement(By.linkText('Home'));
		// home.click();
		// home.then(function(webElement){
		//     driver.actions().mouseMove(webElement).click().perform();
		//     driver.wait(until.elementLocated(By.className('panel-heading')));
		//     foundCatalog = !!driver.findElements(By.linkText('testCatalog23'));
		//     expect(foundCatalog).toBe(true);
		// });
		
		// Selenium has a bug where it wont load the second instruction of a goTo("URL"). I dont even know why this work around works. But it does.
		driver.navigate().to("chrome://version/")
		
		driver.navigate().to("http://localhost:8000/#/offering")
		driver.wait(until.elementLocated(By.linkText('testCatalog23')));
		foundCatalog = driver.findElement(By.linkText('testCatalog23'));
		foundCatalog.then(x => x.getText().then(function(text) {
			expect(text).toBe('testCatalog23');
			done();
		}));
		
	    }else{
		driver.findElement(By.className('btn btn-success')).click();
		driver.wait(until.elementLocated(By.name('name')));
		driver.findElement(By.name('name')).sendKeys('testCatalog21');
		driver.findElement(By.name('description')).sendKeys('A testing description');
		driver.findElement(By.linkText('Next')).click();
		driver.wait(until.elementLocated(By.className('h4 text-dark-secondary')));
		driver.findElement(By.className('btn btn-warning')).click();	    
		driver.wait(until.elementLocated(By.className('h4 text-dark-secondary')));
		var catalogName = driver.findElement(By.name("name"));
		catalogName.getAttribute("value").then(function(name){
		    
		});				       
	    }
	});

	// xit('Create a new product Specification', function(done) {
	    
	//     done();
	// });
    });
});




