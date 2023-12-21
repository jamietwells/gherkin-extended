Feature: User management
  In order to use the system effectively
  As an admin user
  I want to manage user accounts
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