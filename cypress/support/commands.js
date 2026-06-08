Cypress.Commands.add('loginByApi', (username, password) => {
  cy.request({
    method: 'POST',
    url: '/api/login', // Наш фейковый эндпоинт, который создал агент
    body: {
      username: username,
      password: password
    }
  }).then((response) => {
    // Проверяем, что логин успешен
    expect(response.status).to.eq(200);
    // Сохраняем токен в LocalStorage браузера, чтобы фронтенд "поверил", что мы авторизованы
    window.localStorage.setItem('auth_token', response.body.token);
  });
});