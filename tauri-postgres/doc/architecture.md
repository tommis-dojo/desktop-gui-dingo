# Architecture

... if we may name it that.

Communication is done through channels.
The type of the channel specifies which type of message can be passed through it.

We will attempt to create a serializable message on the frontend, which can then be routed to some connector or service on the backend, and will respond in kind.

The desire is to have only one sort of message and little duplicate message processing.