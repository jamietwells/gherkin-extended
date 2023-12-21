# Example Gherkin File

Feature: User management
  In order to use the system effectively
  As an admin user
  I want to manage user accounts

  Background: Users exist in the system
    Given I am logged in as an admin

  Scenario: Admin deletes a user account
    And the user "Charlie" exists
    When I delete the user "Charlie"
    Then no account should exist for "Charlie"

  Scenario Outline: Changing user roles
    Given I am logged in as an admin
    When I change the role of "Alice" to "regular"
    Then the role of "Alice" should be "regular"