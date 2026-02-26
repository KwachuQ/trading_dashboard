# High-Level Rules for Elegant, Efficient, and Secure Code
*Based on "The Pragmatic Programmer: Your Journey to Mastery" by Dave Thomas and Andy Hunt*

This document outlines the core principles and high-level rules to guide agents (and developers) in writing code that is elegant, highly performant, and pragmatically secure. 

---

## 1. Rules for Elegant Code (Maintainability & Design)

Elegant code is defined by its ability to adapt to changes easily, its clear communication of intent, and the minimization of redundant knowledge. 

* **Good Design Is Easier to Change Than Bad Design (ETC):** Every design principle is a special case of ETC (Easier to Change). When faced with a design choice, explicitly ask whether it makes the system easier or harder to adapt to future requirements.
* **DRY—Don't Repeat Yourself:** Every piece of knowledge must have a single, unambiguous, authoritative representation within a system. This goes beyond copying and pasting code; it means avoiding duplication of *intent* across code, schemas, and documentation. 
* **Orthogonality (Eliminate Effects Between Unrelated Things):** Design components that are self-contained, independent, and have a single, well-defined purpose. You should be able to change one component without having to worry about the rest of the system.
* **Tell, Don't Ask:** Do not make decisions based on the internal state of an object and then update that object. Delegate the responsibility to the object itself to maintain the benefits of encapsulation.
* **Don't Chain Method Calls (Law of Demeter):** Avoid "train wrecks" (`a.b().c().d()`). Try not to have more than one dot when you access something to keep dependencies tight and decouple your modules.
* **Name Well; Rename When Needed:** Bestow names according to the role a variable, function, or module plays. Honor the culture of the language, and when you see a misleading or confusing name, fix it immediately.

---

## 2. Rules for Efficient Code (Performance & Structure)

Efficiency isn't just about CPU cycles—it's about structural efficiency, resource management, and decoupled architecture.

* **Estimate Algorithm Speed:** Use Big-O notation to roughly estimate the runtime and memory consumption of your algorithms. Test your estimates by running the code against varying input sizes before taking it to production.
* **Avoid Global Data:** Globally accessible data (including singletons with mutable state and external databases) couples all components that touch it. If it's important enough to be global, wrap it in a strict API.
* **Balance Resources:** The routine or object that allocates a resource should be responsible for deallocating it. When allocating multiple resources, deallocate them in the opposite order of allocation to prevent deadlocks.
* **Take Small Steps—Always:** The rate of feedback is your speed limit. Do not take on steps that are too large or design for a speculative future ("fortune-telling"). Rely on rapid feedback loops via REPLs, unit tests, and user demos.
* **Design for Concurrency:** Analyze workflows for concurrency and parallelism. Use the Actor model, Blackboards, or publish/subscribe streams to manage asynchronous events without coupling your components. Avoid shared state, as "shared state is incorrect state."

---

## 3. Rules for Secure Code (Pragmatic Paranoia)

Security is achieved through a healthy dose of paranoia, anticipating bad data, bad actors, and inevitable faults.

* **Design by Contract (DBC):** Be strict in what you will accept before you begin, and promise as little as possible in return. Explicitly define preconditions, postconditions, and class invariants. If a contract is violated, the program should crash early.
* **Dead Programs Tell No Lies:** A dead program normally does a lot less damage than a crippled one. When your code discovers that something that was supposed to be impossible just happened, terminate the program as soon as possible.
* **Minimize Attack Surface Area:** 
  * *Code Complexity:* Keep code simple and small; complex code hides security holes.
  * *Input Data:* Never trust data from an external entity. Always sanitize and validate input before processing it.
  * *Unauthenticated Services:* Keep the number of authorized users and open services to an absolute minimum.
  * *Output Data:* Do not give away unnecessary information (e.g., in error messages or stack traces).
* **Principle of Least Privilege:** Operate using the least amount of privilege necessary to complete a job, and hold that privilege for the shortest possible time.
* **Secure Defaults:** The default settings of your application should be the most secure values. Let the user actively choose to downgrade security for convenience if they wish.
* **Encrypt Sensitive Data:** Never leave personally identifiable information, financial data, or credentials in plain text. Furthermore, never check secrets, API keys, or SSH keys into version control.
* **Apply Security Patches Quickly:** Keep your infrastructure, dependencies, and libraries constantly updated. The largest data breaches are historically caused by systems running outdated software.