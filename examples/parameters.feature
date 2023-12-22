# Example Gherkin File

Feature: User management
  In order to use the system effectively
  As an admin user
  I want to manage user accounts

  Scenario Outline: Changing user roles
    Given I am logged in as an admin
    When I change the role of "<name>" to "<newRole>"
    Then the role of "<name>" should be "<newRole>"

    Examples:
      | name   | newRole |
      | Alice  | regular |
      | Bob    | admin   |