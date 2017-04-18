require("chromedriver");

describe('Integration tests', function () {

    var mysql = require('mysql');
    var connection = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	password: 'toor'
    });
    
    connection.connect(function(err) {
	if (err) {
	    console.error('error connecting: ' + err.stack);
	    return;
	}
 
	console.log('connected as id ' + connection.threadId);
    });
    
    var webdriver = require('selenium-webdriver'),
	By = webdriver.By,
	until = webdriver.until;
    
    var driver = new webdriver.Builder()
	.forBrowser('chrome')
	.build();
    
    beforeAll(function(done) {
	jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
	
	// DDBB must be cleaned from data, the only thing it should have is the schema.
	done();
    });
    
    afterAll(function(done) {
	driver.quit();
	done();
    });

    fdescribe('User.', function () {

	beforeAll(function(done) {
	    // Populate DDBB
	    done();
	});

	afterAll(function(done) {
	    // Depopulate DDBB
	    done();
	});
	
	userNormal = {id: 'patata@mailinator.com',
		      pass: 'test'};

	userProvider = {id: '58d5266e056d1@mailbox92.biz',
			pass: 'test'};
	
	function checkLogin(driver, user, expectedName, done) {
	    driver.wait(until.titleIs('Biz Ecosystem'));
	    driver.wait(until.elementLocated(By.linkText('Sign in')));
	    driver.findElement(By.linkText('Sign in')).click();
	    driver.wait(until.elementLocated(By.id('id_username')));
	    driver.findElement(By.id('id_username')).sendKeys(user.id);
	    driver.findElement(By.id('id_password')).sendKeys(user.pass);
	    driver.findElement(By.className('btn btn-primary pull-right')).click();
	    driver.wait(until.titleIs('Biz Ecosystem'));
	    var userLogged = driver.findElement(By.className("hidden-xs ng-binding"));
	    userLogged.getText().then(function(name){
		expect(name).toBe(expectedName);
		done();
	    });
	};

	function createProductSpec(driver, product, expectedProduct, done) {
	    var stringSelector = '/html/body/div[4]/div/div[3]/ui-view/ui-view/ui-view/div/div[2]/div/div/div[2]/div[2]/div[4]/div/ng-include/div[2]/div/form[1]/div[1]/div[2]/div/select/option[1]';
	    var numberSelector = '/html/body/div[4]/div/div[3]/ui-view/ui-view/ui-view/div/div[2]/div/div/div[2]/div[2]/div[4]/div/ng-include/div[2]/div/form[1]/div[1]/div[2]/div/select/option[2]';
	    var numberRangeSelector = '/html/body/div[4]/div/div[3]/ui-view/ui-view/ui-view/div/div[2]/div/div/div[2]/div[2]/div[4]/div/ng-include/div[2]/div/form[1]/div[1]/div[2]/div/select/option[3]';
	    driver.findElement(By.linkText('My stock')).click();
	    driver.findElement(By.className('item-icon fa fa-file')).click();
	    // 1
	    driver.findElement(By.className('btn btn-success')).click();
	    driver.wait(until.elementLocated(By.name('name')));
	    driver.findElement(By.name('ProductSpecTest')).sendKeys(product.name);
	    driver.findElement(By.name('version')).sendKeys(product.version);
	    driver.findElement(By.name('brand')).sendKeys(product.brand);
	    driver.findElement(By.name('productNumber')).sendKeys(product.productNumber);
	    driver.findElement(By.name('description')).sendKeys(product.description);
	    driver.findElement(By.className('btn btn-default z-depth-1')).click();
	    // 2
	    driver.wait(until.elementLocated(By.className('track')));
	    driver.findElement(By.className('btn btn-default z-depth-1')).click();
	    // 3
	    driver.wait(until.elementLocated(By.className('track')));
	    driver.findElement(By.className('btn btn-default z-depth-1')).click();
	    // 4
	    driver.wait(until.elementLocated(By.className('item-icon fa fa-plus')));
	    if(product.characteristics){
		product.characteristics.forEach(characteristic =>
						driver.findElement(By.className('btn btn-default z-depth-1 ng-scope')).click();
						driver.wait(until.elementLocated(By.name('name'))).sendKeys(characteristic.name);
						driver.findElement(By.name('description')).sendKeys(characteristic.description);
						// Now i should send the value to the proper field, but first i need to select the correct selector
						if (characteristic.value.type === 'number'){
						    driver.findElement(By.css(numberSelector)).click();
						    driver.findElement(By.name('unitOfMeasure')).sendKeys(characteristic.value.unit);
						    driver.findElement(By.name('value')).sendKeys(characteristic.value.val);
						}else if(characteristic.value.type === 'numberRange'){
						    driver.findElement(By.css(numberRangeSelector)).click();
						    driver.findElement(By.name('valueFrom')).sendKeys(characteristic.value.valFrom);
						    driver.findElement(By.name('valueTo')).sendKeys(characteristic.value.valTo);
						    driver.findElement(By.name('unitOfMeasure')).sendKeys(characteristic.value.unit);
						}else{
						    driver.findElement(By.name('value')).sendKeys(characteristic.value.val);
						}
						driver.findElement(By.className('item-icon fa fa-plus')).click();
					       )
		driver.findElement(By.className('btn btn-warning z-depth-1 ng-scope')).click();
	    }
	    driver.findElement(By.className('btn btn-default z-depth-1')).click();
	    // 5
	    driver.wait(until.elementLocated(By.className('thumbnail thumbnail-lg')));
	    if (product.picture){
		// Its only a test so we only accept picture URLs
		driver.findElement(By.name('picture')).sendKeys(product.picture)
	    }
	    driver.findElement(By.className('btn btn-default z-depth-1')).click();
	    // 6
	    driver.wait(until.elementLocated(By.name('type')));
	    driver.findElement(By.className('btn btn-default z-depth-1')).click();
	    // 7
	    driver.wait(until.elementLocated(By.className('text-muted')));
	    driver.findElement(By.name('title')).sendKeys(product.title);
	    driver.findElement(By.name('text')).sendKeys(product.text);
	    driver.findElement(By.className('btn btn-default z-depth-1')).click();
	    driver.wait(until.elementLocated(By.name('name')));
	    // TODO: Check that all parameters are the correct ones before creating the product.


	    
	    driver.findElement(By.className('btn btn-warning')).click();
	};
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
	    checkLogin(driver, userProvider, 'testfiware', done);
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
	    var foundCatalog = !!driver.wait(until.elementLocated(By.linkText('testCata')));
	    if(foundCatalog){
		driver.findElement(By.linkText('testCata')).click();
		driver.findElement(By.className('btn btn-success')).click();
		driver.wait(until.elementLocated(By.linkText('Home')));		
		// Selenium has a bug where it wont load the second instruction of a goTo("URL"). I dont even know why this work around works. But it does.
		// If Jesus can walk on water. Can he swim on land?
		driver.navigate().to("chrome://version/")
		driver.navigate().to("http://localhost:8000/#/offering")
		
		driver.wait(until.elementLocated(By.linkText('testCata')));
		foundCatalog = driver.findElement(By.linkText('testCata'));
		foundCatalog.then(x => x.getText().then(function(text) {
			expect(text).toBe('testCatalog23');
			done();
		}));
		// TODO
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
		    // TODO
		});
		// driver.wait(until.elementLocated(By.className('status-item status-launched')));
		// expect(name).toBe('testCatalog20');
		// var icon = driver.findElement(By.css("div.status-item.status-launched"));
		// driver
		//     .actions()
		//     .click(icon)
		//     .perform();
		driver.wait(until.elementLocated(By.className('status-item status-launched active')));
	    }
	});

	xit('Create a new product Specification', function(done) {
	    var product = {};
	    var expectedProduct = {};
	    
	    driver.wait(until.titleIs('Biz Ecosystem'));
	    // Call the function
	    createProductSpec(driver, product, expectedProduct, done);
	    
	});
    });
});




