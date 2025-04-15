"""
Utility functions for the test repository.
This file contains standalone utility functions to test the code parsing functionality.
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

from .data_model import User, Repository


def load_json_file(file_path: str) -> Dict[str, Any]:
    """
    Load a JSON file and return its contents as a dictionary.
    
    Args:
        file_path: Path to the JSON file
        
    Returns:
        Dictionary containing the JSON data
        
    Raises:
        FileNotFoundError: If the file does not exist
        json.JSONDecodeError: If the file is not valid JSON
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    with open(file_path, 'r') as f:
        return json.load(f)


def save_json_file(file_path: str, data: Dict[str, Any]) -> None:
    """
    Save a dictionary as a JSON file.
    
    Args:
        file_path: Path where the JSON file should be saved
        data: Dictionary to save
        
    Raises:
        TypeError: If the data cannot be serialized to JSON
    """
    directory = os.path.dirname(file_path)
    if directory and not os.path.exists(directory):
        os.makedirs(directory)
    
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)


def format_timestamp(timestamp: float) -> str:
    """
    Format a Unix timestamp as a human-readable date string.
    
    Args:
        timestamp: Unix timestamp (seconds since epoch)
        
    Returns:
        Formatted date string (YYYY-MM-DD HH:MM:SS)
    """
    dt = datetime.fromtimestamp(timestamp)
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def parse_timestamp(date_string: str) -> float:
    """
    Parse a date string into a Unix timestamp.
    
    Args:
        date_string: Date string in format YYYY-MM-DD HH:MM:SS
        
    Returns:
        Unix timestamp (seconds since epoch)
        
    Raises:
        ValueError: If the date string is not in the expected format
    """
    dt = datetime.strptime(date_string, "%Y-%m-%d %H:%M:%S")
    return dt.timestamp()


def load_repository(repo_path: str) -> Optional[Repository]:
    """
    Load a repository from a JSON file.
    
    Args:
        repo_path: Path to the repository JSON file
        
    Returns:
        Repository object, or None if the file does not exist
    """
    try:
        data = load_json_file(repo_path)
        
        # Load users first
        users = {}
        for user_data in data.get("users", []):
            user = User.from_dict(user_data)
            if user.id:
                users[user.id] = user
        
        # Then load the repository
        repo_data = data.get("repository", {})
        return Repository.from_dict(repo_data, users)
    
    except FileNotFoundError:
        return None


def save_repository(repo_path: str, repository: Repository) -> None:
    """
    Save a repository to a JSON file.
    
    Args:
        repo_path: Path where the repository JSON file should be saved
        repository: Repository object to save
    """
    # Collect all users (owner and commit authors)
    users = {}
    if repository.owner and repository.owner.id:
        users[repository.owner.id] = repository.owner
    
    for commit in repository.commits:
        if commit.owner and commit.owner.id:
            users[commit.owner.id] = commit.owner
    
    # Create the data structure
    data = {
        "repository": repository.to_dict(),
        "users": [user.to_dict() for user in users.values()]
    }
    
    save_json_file(repo_path, data)


class Logger:
    """Simple logger class for the test repository."""
    
    @staticmethod
    def info(message: str) -> None:
        """Log an informational message."""
        print(f"[INFO] {message}")
    
    @staticmethod
    def warning(message: str) -> None:
        """Log a warning message."""
        print(f"[WARNING] {message}")
    
    @staticmethod
    def error(message: str) -> None:
        """Log an error message."""
        print(f"[ERROR] {message}")
