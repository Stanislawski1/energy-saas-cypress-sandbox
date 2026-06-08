Feature: User Login
  As a user of the B2B platform,
  I want to log in,
  So that I can access my dashboard.

  Scenario: User successfully logs in
    Given I navigate to the login page
    When I enter my credentials
    And I click the login button
    Then I should be redirected to the dashboard
