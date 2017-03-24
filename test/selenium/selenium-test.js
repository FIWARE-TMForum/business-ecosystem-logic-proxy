require("chromedriver");

describe('Integration tests', function () {

    
    var webdriver = require('selenium-webdriver'),
	By = webdriver.By,
	until = webdriver.until;
    
    var driver = new webdriver.Builder()
	.forBrowser('chrome')
	.build();
    
    fdescribe('User logs in, updates his/her info, creates a new category, uploads a new product and creates an offering containing that product.', function () {
	
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
	
	
	driver.get('http://localhost:8000/#/offering');
	
	it('Should be able to log in with a correct username and password', function (done) {
	    driver.wait(until.titleIs('Biz Ecosystem'));
	    driver.wait(until.elementLocated(By.linkText('Sign in')));
	    driver.findElement(By.linkText('Sign in')).click();
	    driver.wait(until.elementLocated(By.id('id_username')));
	    // CAUTION: CHANGE patata TO potorro BEFORE ANY TEST. 
	    driver.findElement(By.id('id_username')).sendKeys(userProvider.id);
	    driver.findElement(By.id('id_password')).sendKeys(userProvider.pass);
	    driver.findElement(By.className('btn btn-primary pull-right')).click();
	    driver.wait(until.titleIs('Biz Ecosystem'));
	    var userLogged = driver.findElement(By.className("hidden-xs ng-binding"));
	    userLogged.getText().then(function(name){
		expect(name).toBe('test2');
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
	    // TODO: Change this expect. This checks nothing
	    driver.getTitle().then(function (title) {
		expect(title).toBe('Biz Ecosystem');
		done();
	    });
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
	    	});
	    }
	    done();
	});

	it('Create a new catalog', function(done) {
	    driver.findElement(By.className('btn btn-default z-depth-1')).click();
	    driver.wait(until.titleIs('Biz Ecosystem'));
	    driver.findElement(By.linkText('My stock')).click();
	    driver.wait(until.elementLocated(By.className('btn btn-success')));
	    driver.findElement(By.className('btn btn-success')).click();
	    driver.wait(until.elementLocated(By.name('name')));
	    driver.findElement(By.name('name')).sendKeys('testCatalog');
	    driver.findElement(By.name('description')).sendKeys('A testing description');
	    driver.wait(until.elementLocated(By.className('h4 text-dark-secondary')));
	    driver.findElement(By.className('btn btn-warning')).click();	    
	    driver.wait(until.titleIs('Biz Ecosystem'));
	    var catalogName = driver.findElement(By.name("name"));
	    catalogName.getText().then(function(name){
		expect(name).toBe('testCatalog');
	    });
	    driver.wait(until.elementLocated(By.className('status-item status-launched')));
	    driver.findElement(By.className('status-item status-launched')).click();
	    driver.findElement(By.className('btn btn-success')).click();
	    driver.findElement(By.linkText('Home')).click();
	    driver.wait(until.elementLocated(By.className('panel-heading')));
	    foundCatalog = !!driver.findElements(By.linkText('testCatalog'));
	    expect(foundCatalog).toBe(true);
	    done();
	});
    });
});




