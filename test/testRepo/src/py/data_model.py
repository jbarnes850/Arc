"""
Data model classes for the test repository.
This file contains multiple classes with methods to test the code parsing functionality.
"""

class BaseModel:
    """Base class for all data models."""
    
    def __init__(self, id=None):
        """Initialize the base model with an optional ID."""
        self.id = id
    
    def to_dict(self):
        """Convert the model to a dictionary."""
        return {"id": self.id}
    
    @classmethod
    def from_dict(cls, data):
        """Create a model instance from a dictionary."""
        return cls(id=data.get("id"))


class User(BaseModel):
    """User model representing a system user."""
    
    def __init__(self, id=None, name=None, email=None):
        """Initialize a user with optional ID, name, and email."""
        super().__init__(id)
        self.name = name
        self.email = email
    
    def to_dict(self):
        """Convert the user to a dictionary."""
        data = super().to_dict()
        data.update({
            "name": self.name,
            "email": self.email
        })
        return data
    
    @classmethod
    def from_dict(cls, data):
        """Create a user instance from a dictionary."""
        return cls(
            id=data.get("id"),
            name=data.get("name"),
            email=data.get("email")
        )
    
    def validate(self):
        """Validate the user data."""
        if not self.email or "@" not in self.email:
            raise ValueError("Invalid email address")
        return True


class Repository(BaseModel):
    """Repository model representing a code repository."""
    
    def __init__(self, id=None, name=None, url=None, owner=None):
        """Initialize a repository with optional ID, name, URL, and owner."""
        super().__init__(id)
        self.name = name
        self.url = url
        self.owner = owner
        self.commits = []
    
    def to_dict(self):
        """Convert the repository to a dictionary."""
        data = super().to_dict()
        data.update({
            "name": self.name,
            "url": self.url,
            "owner": self.owner.to_dict() if self.owner else None,
            "commits": [commit.to_dict() for commit in self.commits]
        })
        return data
    
    def add_commit(self, commit):
        """Add a commit to the repository."""
        self.commits.append(commit)
    
    @classmethod
    def from_dict(cls, data, users=None):
        """Create a repository instance from a dictionary."""
        users = users or {}
        repo = cls(
            id=data.get("id"),
            name=data.get("name"),
            url=data.get("url")
        )
        
        # Set owner if available
        owner_data = data.get("owner")
        if owner_data and owner_data.get("id") in users:
            repo.owner = users[owner_data.get("id")]
        
        return repo


# Standalone function outside of any class
def create_user(name, email):
    """Create a new user with the given name and email."""
    user = User(name=name, email=email)
    user.id = generate_id()
    return user


def generate_id():
    """Generate a unique ID."""
    import uuid
    return str(uuid.uuid4())
