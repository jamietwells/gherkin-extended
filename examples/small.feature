# Example Gherkin File

Scenario: Non-admin cannot create user
  Given I am logged in as a regular user
  # We test this later
  But I do not have admin privileges
  When I attempt to create a new user account
  Then I should receive an error message