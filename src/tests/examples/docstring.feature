Feature: Blog Post Management

  Scenario: Creating a blog post with detailed content
    Given the user "admin" is logged in
    When the user creates a new blog post with the following content:
      """
      Title: Adventures in Testing
      Body:
      Exploring the challenges and joys of software testing.
      "Quotes" can be tricky, but not if you're careful.
      """
    Then the blog post should be successfully created

  Scenario: Providing code examples in a blog post
    Given the user "developer" is logged in
    When the user adds a new section to the blog post with the following code snippet:
      """
      ```
      function helloWorld() {
        console.log("Hello, world!");
      }
      ```
      Note: Ensure to replace "world" with your name.
      """
    Then the code snippet should be visible in the blog post preview

  Scenario: Escaping quotes within Doc Strings
    Given the user "editor" is reviewing content
    When the editor sees the following review comment:
      """
      Reviewer's comment: "Excellent post! However, please consider changing the phrase 'not if you're careful' to 'with the right approach'."
      """
    Then the editor should be able to edit the post accordingly
