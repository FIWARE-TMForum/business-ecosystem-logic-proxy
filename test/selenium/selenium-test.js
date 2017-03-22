require("chromedriver");

var webdriver = require('selenium-webdriver'),
    By = webdriver.By,
    until = webdriver.until;

var driver = new webdriver.Builder()
    .forBrowser('chrome')
    .build();

// By default, the user has to sign in
driver.get('http://localhost:8000/#/offering');
driver.wait(until.titleIs('Biz Ecosystem'), 1000);
driver.findElement(By.linkText('Sign in')).click();
driver.wait(until.elementLocated(By.id('id_username')));
driver.findElement(By.id('id_username')).sendKeys('eugenio90@gmail.com');
driver.findElement(By.id('id_password')).sendKeys('09021990');
driver.findElement(By.className('btn btn-primary pull-right')).click();
driver.wait(until.titleIs('Biz Ecosystem'));

// Go to Settings page
driver.findElement(By.className('dropdown-toggle has-stack')).click();
driver.findElement(By.id('Settings')).click();

// Change some of the values
var fieldName = driver.wait(until.elementLocated(By.name('firstName')));
fieldName.clear();
fieldName.sendKeys('testName');
driver.findElement(By.name('lastName')).clear();
driver.findElement(By.name('lastName')).sendKeys('testSurName');
driver.findElement(By.className('btn btn-success')).click();
driver.wait(until.titleIs('Biz Ecosystem'));

// Lets create some category hierarchy
// Go to Admin page
driver.findElement(By.className('dropdown-toggle has-stack')).click();
driver.findElement(By.id('Admin')).click();

// Create a new parent category


driver.quit();
