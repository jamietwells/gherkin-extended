# Example Gherkin File

Feature: User management
  In order to use the system effectively
  As an admin user
  I want to manage user accounts

  Background: Users exist in the system
    Given the following users exist:
      | name   | email             | role    |
      | Alice  | alice@example.com | admin   |
      | Bob    | bob@example.com   | regular |

  Scenario: Admin creates a new user account
    Given I am logged in as an admin
    When I create a new user account with the following details:
      | name   | email               | role    |
      | Charlie | charlie@example.com | regular |
    Then a user account should be created for Charlie

  Scenario Outline: Changing user roles
    Given I am logged in as an admin
    When I change the role of "<name>" to "<newRole>"
    Then the role of "<name>" should be "<newRole>"

    Examples:
      | name   | newRole |
      | Alice  | regular |
      | Bob    | admin   |

  @tag1 @tag2
  Scenario: Admin deletes a user account
    Given I am logged in as an admin
    And the user "Charlie" exists
    When I delete the user "Charlie"
    Then no account should exist for "Charlie"

  Scenario: Non-admin cannot create user
    Given I am logged in as a regular user
    But I do not have admin privileges
    When I attempt to create a new user account
    Then I should receive an error message

  Rule: Password management

    Example: Users can change their own passwords
      Given I am logged in as "Bob"
      When I change my password
      Then my password should be updated

    Example: Admins can reset user passwords
      Given I am logged in as an admin
      When I reset the password for "Alice"
      Then the password for "Alice" should be reset
