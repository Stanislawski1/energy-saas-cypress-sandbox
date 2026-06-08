import { Given, When, Then } from "@badeball/cypress-cucumber-preprocessor";

Given("I am logged in as an admin via API", () => {
  // Вызываем нашу кастомную команду
  cy.loginByApi('admin', 'password123');
});

When("I navigate to the billing dashboard", () => {
  // Идем на страницу дашборда (токен уже в LocalStorage, так что нас пустит)
  cy.visit('/dashboard');
});

When("I trigger the invoice generation", () => {
  // ВАЖНО: Мы должны подготовить "ловушку" для API ДО того, как кликнем на кнопку!
  cy.intercept('POST', '/api/billing/generate').as('generateBillApi');
  
  // Кликаем по кнопке (представь, что агент сделал кнопку с таким ID)
  cy.get('#generate-invoice-btn').click();
});

Then("I should see a success message", () => {
  // Проверяем UI: появилась ли зеленая плашка успеха
  cy.get('.toast-success')
    .should('be.visible')
    .and('contain', 'Invoice generated successfully');
});

Then("the API should return a 201 status code", () => {
  // Проверяем Backend: дожидаемся ответа от перехваченного API-запроса
  cy.wait('@generateBillApi').then((interception) => {
    expect(interception.response.statusCode).to.eq(201);
    // Бонус: можно проверить структуру ответа
    expect(interception.response.body).to.have.property('invoiceId');
  });
});