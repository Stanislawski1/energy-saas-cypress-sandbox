Feature: Energy Billing Generation
  As an admin of the Energy platform,
  I want to generate a monthly invoice for a client,
  So that they can be billed for their energy consumption.

  Scenario: Admin successfully generates a monthly invoice
    Given I am logged in as an admin via API
    When I navigate to the billing dashboard
    And I trigger the invoice generation
    Then I should see a success message
    And the API should return a 201 status code
