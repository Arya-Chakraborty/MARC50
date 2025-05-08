from joblib import load
import os

# --- !! IMPORTANT: Set this path correctly !! ---
# Construct the path to your models directory
# If your index.py is in 'project_root/index.py' and models are in 'project_root/tree_reg_models/'
# base_dir_for_script = os.path.dirname(os.path.abspath(__file__)) # If script is in project_root
# model_dir = os.path.join(base_dir_for_script, 'tree_reg_models')

# Or, provide a direct relative or absolute path:
model_dir = 'tree_reg_models' # If this script is run from the same directory as index.py
# model_dir = r'D:\path\to\your\project\tree_reg_models' # Example absolute path

model_file_to_inspect = os.path.join(model_dir, 'tree_0.joblib') # Inspect the first tree

if not os.path.exists(model_file_to_inspect):
    print(f"Error: Model file not found at {model_file_to_inspect}")
    print("Please ensure the path to 'tree_0.joblib' is correct.")
else:
    try:
        loaded_tree_model = load(model_file_to_inspect)
        
        if hasattr(loaded_tree_model, 'feature_names_in_'):
            actual_fit_time_feature_order = list(loaded_tree_model.feature_names_in_)
            print("Feature order expected by the saved regression model (tree_0.joblib):")
            print(actual_fit_time_feature_order)
            print(f"\nNumber of features expected: {len(actual_fit_time_feature_order)}")
            print("\nCOPY THIS LIST (above) and use it as the 'regression_required_descriptors' in your index.py file.")
        elif hasattr(loaded_tree_model, 'n_features_in_'):
             print(f"Model expects {loaded_tree_model.n_features_in_} features, but feature_names_in_ is not available.")
             print("You will need to get the feature order from your X_train.columns in the training script.")
        else:
            print("The loaded regression model does not have 'feature_names_in_' or 'n_features_in_'.")
            print("Please obtain the exact feature list and order from the 'X_train.columns' (or 'X_bootstrap.columns')")
            print("used during the .fit() call in your original training script.")

    except Exception as e:
        print(f"An error occurred while loading or inspecting the model: {e}")
        print("Ensure you have the correct versions of scikit-learn and joblib used for training.")