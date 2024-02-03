# Feature with minimal description
Feature: Complex User Management

  # Background with a table
  Background: User exists
    Given the following user exists:
      | name    | email             | role  |
      | Alice   | alice@example.com | admin |
      # Inline comment
    And the database is ready

  # Scenario with parameterized steps and a doc string
  Scenario: Admin creates a new user account
    When the admin user "<adminName>" creates a new account with the name "Bob"
      """
      User details:
      - Name: Bob
      - Role: user
      """
    Then the user "Bob" should be present in the system

  # Scenario with consecutive blank lines and comments

  Scenario: User deletion
    Given the user "Charlie" exists

    # This is a tricky part
    When the admin deletes the user "Charlie"


    Then the user "Charlie" should not exist in the system

  # Scenario Outline with less common whitespace handling
  @smoke
  Scenario Outline: Password change
    Given user "<name>" is logged in
    When user "<name>" changes their password to "<newPassword>"

    Then the new password should be "<newPassword>"

    Examples:
      | name   | newPassword |
      | Alice  | secret123   |
      | Bob    | password    |

# Another feature in the same file, which is unusual
Feature: Additional Feature in Same File
  Scenario: Just to add complexity
    Given something is done
