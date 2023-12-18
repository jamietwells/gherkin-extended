Feature: User management
  Scenario: Non-admin cannot create user
    Given I am logged in as a regular user
    But I do not have admin privileges
    When I attempt to create a new user account
    Then I should receive an error message

  Scenario: Non-admin cannot create user
    Given I am logged in as a regular user
    But I do not have admin privileges
    When I attempt to create a new user account
    Then I should receive an error message